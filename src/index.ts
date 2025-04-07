import express from 'express';
import { exec } from 'child_process';
import url from 'url';
import path from 'path';
import { getMarkdownTreeMetadata } from './utils'
import { batchCreatePost } from './orm'
import R from 'ramda'
import logger from './logger'


const app = express();
const port = 7778;

// Middleware to parse JSON request bodies
app.use(express.json());

let debounceTimeout: NodeJS.Timeout | null = null;

//@ts-ignore
app.post('/hooks', (req, res) => {
	const queryObject = url.parse(req.url, true).query as HookParams;
	const script = queryObject.shell;
	const scriptDir = queryObject.dir || __dirname; // 默认工作目录
	const executeType = queryObject.type; // 执行类型：shell or function

	const executeFnName = queryObject.fn

	if (!script) {
		return res.status(400).send({ error: 'Shell script not specified in query parameters' });
	}

	

	if (debounceTimeout) {
		clearTimeout(debounceTimeout);
	}

	debounceTimeout = setTimeout(() => {
    logger.info(`Start Execute`)

		if (executeType === 'function') {
			logger.info("execute function", executeFnName)

			executeFnName === 'scanPost'
				? R.pipe(getMarkdownTreeMetadata, batchCreatePost)(scriptDir)
				: logger.error(`不支持的操作 ${executeFnName}`)

		} else {
			// 设置工作目录
			const options = { cwd: path.resolve(scriptDir) };

			// Execute the shell script
			exec(`sh ${script}.sh`, options, (error, stdout, stderr) => {
				if (error) {
					logger.info(`Error executing script: ${error.message}`);
				}
				if (stderr) {
					logger.info(`Script error: ${stderr}`);
				}

				executeFnName === 'scanPost'
					? R.pipe(getMarkdownTreeMetadata, batchCreatePost)(path.resolve(scriptDir, "src/site/notes"))
					: logger.info('TODO')
				logger.info(`Script output: ${stdout}`);
			});
		}
	}, 1000 * 10); // 1000ms debounce time
	return res.status(200).send({ message: 'Script execution scheduled' });
});


app.listen(port, () => {
	logger.info(`服务启动，端口： ${port}`);
});
