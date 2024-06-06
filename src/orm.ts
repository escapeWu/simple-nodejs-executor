import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export function batchCreatePost(posts: Post[]){
	return prisma.post.deleteMany({})
		.then(() => prisma.post.createMany({
			data: posts
		}))
}

prisma.post.deleteMany({})