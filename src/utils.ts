import fs from 'fs'
import path from 'path'

function walkDir(directory: string, processFn: (filePath: string) => void) {
	// 读取当前目录下的所有文件和子目录
	const filesAndDirs = fs.readdirSync(directory);

	for (const entry of filesAndDirs) {
		const fullPath = path.join(directory, entry);
		const stats = fs.statSync(fullPath);
		stats.isDirectory() ? walkDir(fullPath, processFn) : processFn(fullPath);
	}
}


function getMarkdownMetaData(filePath: string): Post | null {
	const stats = fs.statSync(filePath);
	if (stats.isFile() && path.extname(filePath) === '.md') {
		// 如果是 Markdown 文件，读取内容并提取第二行
		const fileContent = fs.readFileSync(filePath, 'utf-8');
		const lines = fileContent.split('\n');

		// 检查文件是否至少有两行
		if (lines.length >= 2) {
			const metadata = JSON.parse(lines[1]) as DigtalGardenMetadata;
			return {
				created: metadata.created,
				updated: metadata.updated,
				title: metadata.title ?? path.basename(filePath, '.md'),
				link: metadata.permalink,
				content: lines.slice(3).join('\n')
			}
		}
	}
	return null
}


// path.join(__dirname, relativePath
export function getMarkdownTreeMetadata(absolutePath: string) {
	const result: Post[] = []
	walkDir(absolutePath, (filePath: string) => {
		const metadata = getMarkdownMetaData(filePath);
		metadata && result.push(metadata);
	})
	return result
}

// pipe(getMarkdownTreeMetadata, batchCreatePost)('C:\\Users\\m1876\\project\\knowledge-base\\src\\site\\notes')
