import { WORDPRESS_GRAPHQL_ENDPOINT } from 'astro:env/server'

const PRODUCTION_WORDPRESS_GRAPHQL_ENDPOINT = 'https://uainclusive.getquick.io/graphql'

if (WORDPRESS_GRAPHQL_ENDPOINT !== PRODUCTION_WORDPRESS_GRAPHQL_ENDPOINT) {
  throw new Error(
    `WORDPRESS_GRAPHQL_ENDPOINT must be ${PRODUCTION_WORDPRESS_GRAPHQL_ENDPOINT}. Received: ${WORDPRESS_GRAPHQL_ENDPOINT}`,
  )
}

type GraphqlResponse<T> = {
  data?: T
  errors?: Array<{ message?: string }>
}

type WpPostNode = {
  id: string
  slug: string
  title?: string | null
  excerpt?: string | null
  content?: string | null
  date?: string | null
  author?: {
    node?: {
      name?: string | null
    } | null
  } | null
}

export type BlogPost = {
  id: string
  slug: string
  title: string
  excerptHtml: string
  excerptText: string
  contentHtml: string
  date: string
  authorName: string
  shortTitle: string
  imagePath: string
}

const postImages = [
  '/posts/post-image-1.png',
  '/posts/post-image-2.png',
  '/posts/post-image-3.png',
  '/posts/post-image-4.png',
  '/posts/post-image-5.png',
  '/posts/post-image-6.png',
]

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

const truncateWords = (value: string, maxWords = 4): string => {
  const words = value.trim().split(/\s+/)
  if (words.length <= maxWords) {
    return value
  }
  return words.slice(0, maxWords).join(' ')
}

const getImagePathFromSeed = (seed: string): string => {
  const index = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0) % postImages.length
  return postImages[index]
}

async function queryWordPress<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(WORDPRESS_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`WordPress GraphQL request failed: ${response.status} ${response.statusText}`)
  }

  const json = (await response.json()) as GraphqlResponse<T>

  if (json.errors?.length) {
    const messages = json.errors.map((error) => error.message ?? 'Unknown GraphQL error').join('; ')
    throw new Error(`WordPress GraphQL returned errors: ${messages}`)
  }

  if (!json.data) {
    throw new Error('WordPress GraphQL returned no data')
  }

  return json.data
}

function mapWpPost(node: WpPostNode): BlogPost {
  const title = (node.title ?? 'Untitled').trim()
  const excerptHtml = node.excerpt ?? ''
  const contentHtml = node.content ?? ''

  return {
    id: node.id,
    slug: node.slug,
    title,
    excerptHtml,
    excerptText: stripHtml(excerptHtml),
    contentHtml,
    date: node.date ?? '',
    authorName: node.author?.node?.name ?? 'Unknown author',
    shortTitle: truncateWords(title),
    imagePath: getImagePathFromSeed(node.slug || node.id),
  }
}

export async function getAllBlogPosts(limit = 100): Promise<BlogPost[]> {
  const query = `
    query GetPosts($first: Int!) {
      posts(first: $first) {
        nodes {
          id
          slug
          title
          excerpt
          content
          date
          author {
            node {
              name
            }
          }
        }
      }
    }
  `

  const data = await queryWordPress<{ posts?: { nodes?: WpPostNode[] | null } | null }>(query, { first: limit })
  const nodes = data.posts?.nodes ?? []
  return nodes.filter((node): node is WpPostNode => Boolean(node?.id && node?.slug)).map(mapWpPost)
}

export async function getFeaturedBlogPosts(limit = 3): Promise<BlogPost[]> {
  const posts = await getAllBlogPosts(Math.max(limit, 3))
  return posts.slice(0, limit)
}
