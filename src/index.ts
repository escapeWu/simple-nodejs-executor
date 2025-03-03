import express from 'express';
import { exec, ChildProcess } from 'child_process';
import url from 'url';
import path from 'path';
import { getMarkdownTreeMetadata } from './utils';
import { batchCreatePost } from './orm';
import { v4 as uuidv4 } from 'uuid';

type HookParams = {
  shell?: string;
  dir?: string;
  type?: 'shell' | 'function';
  fn?: string;
};

type ExecutionContext = {
  requestId: string;
  startTime: number;
  params: HookParams;
};

const app = express();
const port = 7778;

// 中间件扩展
app.use(express.json());
app.use((req, res, next) => {
  res.locals.context = {
    requestId: uuidv4(),
    startTime: Date.now(),
  };
  next();
});

// 防抖控制器
const debounceManager = {
  timeoutId: null as NodeJS.Timeout | null,
  lastContext: null as ExecutionContext | null,

  schedule(task: () => void, delay: number, context: ExecutionContext) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.log('CANCEL_PREVIOUS', context);
    }
    
    this.timeoutId = setTimeout(() => {
      task();
      this.timeoutId = null;
      this.lastContext = context;
    }, delay);
  },

  log(action: string, context: ExecutionContext) {
    console.log(formatLog('INFO', action, context));
  }
};

// 路由处理
app.post('/hooks', async (req, res) => {
  const context = createExecutionContext(res);
  const params = parseRequestParams(req);
  
  if (!validateParams(params, res, context)) return;

  debounceManager.schedule(
    () => executeTask(params, context),
    1000 * 10,
    context
  );

  sendAcceptedResponse(res, context);
});

// 工具函数
function createExecutionContext(res: express.Response): ExecutionContext {
  return {
    requestId: res.locals.context.requestId,
    startTime: res.locals.context.startTime,
    params: {} as HookParams,
  };
}

function parseRequestParams(req: express.Request): HookParams {
  return url.parse(req.url, true).query as HookParams;
}

function validateParams(params: HookParams, res: express.Response, context: ExecutionContext): boolean {
  if (!params.shell) {
    logError('MISSING_SCRIPT', context);
    res.status(400).send({ error: 'Shell script not specified in query parameters' });
    return false;
  }

  if (params.type === 'function' && !params.fn) {
    logError('MISSING_FUNCTION', context);
    res.status(400).send({ error: 'Function name required when type=function' });
    return false;
  }

  return true;
}

async function executeTask(params: HookParams, context: ExecutionContext) {
  try {
    context.params = params;
    logStart(context);

    if (params.type === 'function') {
      await executeFunction(params, context);
    } else {
      await executeShellScript(params, context);
    }

    logSuccess(context);
  } catch (error) {
    logError('EXECUTION_FAILED', context, error as Error);
  }
}

// 执行逻辑
async function executeShellScript(params: HookParams, context: ExecutionContext) {
  const scriptPath = path.resolve(params.dir || __dirname, `${params.shell}.sh`);
  const options = { cwd: path.dirname(scriptPath) };

  await new Promise((resolve, reject) => {
    const child: ChildProcess = exec(`sh ${scriptPath}`, options, (error, stdout, stderr) => {
      // 仅当 exit code 非 0 时视为错误
      if (error) {
        error.message = [
          stderr?.trim(), 
          stdout?.trim()
        ].filter(Boolean).join('\n');
        return reject(error);
      }
      resolve(null);
    });

    // 实时处理输出流
    child.stdout?.on('data', (data: Buffer) => {
      logProcessOutput(data.toString(), context, 'DEBUG');
    });
    
    child.stderr?.on('data', (data: Buffer) => {
      logProcessOutput(data.toString(), context, 'WARN');
    });
  });

  if (params.fn === 'scanPost') {
    await processMarkdownFiles(params, context);
  }
}

async function executeFunction(params: HookParams, context: ExecutionContext) {
  if (params.fn === 'scanPost') {
    const targetDir = params.dir 
      ? path.resolve(params.dir, "src/site/notes")
      : path.resolve(__dirname, "src/site/notes");
    
    await processMarkdownFiles({ ...params, dir: targetDir }, context);
  }
}

async function processMarkdownFiles(params: HookParams, context: ExecutionContext) {
  logSubTask('PROCESS_MARKDOWN', context);
  const metadata = await getMarkdownTreeMetadata(params.dir!);
  await batchCreatePost(metadata);
}

// 响应处理
function sendAcceptedResponse(res: express.Response, context: ExecutionContext) {
  res.status(202).send({ 
    message: 'Execution scheduled',
    requestId: context.requestId,
    scheduledAt: new Date(context.startTime + 10000)
  });
}

// 日志工具
function formatLog(
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  action: string,
  context: ExecutionContext,
  extras?: object
): string {
  return JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    action,
    ...context,
    ...extras,
    params: {
      ...context.params,
      dir: context.params.dir ? path.resolve(context.params.dir) : undefined
    }
  });
}

function logStart(context: ExecutionContext) {
  console.log(formatLog('INFO', 'EXECUTION_START', context));
}

function logSuccess(context: ExecutionContext) {
  console.log(formatLog('INFO', 'EXECUTION_SUCCESS', context, {
    duration: Date.now() - context.startTime
  }));
}

function logError(type: string, context: ExecutionContext, error?: Error) {
  console.error(formatLog('ERROR', type, context, {
    error: error ? {
      message: error.message,
      stack: error.stack
    } : undefined,
    duration: Date.now() - context.startTime
  }));
}

function logProcessOutput(
  output: string,
  context: ExecutionContext,
  level: 'DEBUG' | 'WARN' = 'DEBUG'
) {
  output.split('\n').forEach(line => {
    if (line.trim()) {
      console.log(formatLog(level, 'PROCESS_OUTPUT', context, {
        output: line.trim()
      }));
    }
  });
}

function logSubTask(action: string, context: ExecutionContext) {
  console.log(formatLog('INFO', action, context));
}

app.listen(port, () => {
  console.log(formatLog('INFO', 'SERVER_START', {
    requestId: 'SYSTEM',
    startTime: Date.now(),
    params: {}
  } as ExecutionContext, {
    message: `Server started on port ${port}`
  }));
});
