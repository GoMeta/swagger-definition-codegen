const fs = require('fs');
const fsExtra = require('fs-extra');

function printHandlers(paths, outputDir) {
  console.log("Printing handlers...");
  fsExtra.ensureDirSync(outputDir);
  printApiResponseClass(outputDir);
  printBaseRouteImplClass(outputDir);
  Object.keys(paths)
      .forEach((path) => printHandler(path, paths[path], `${outputDir}${path}.js`));
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
}

function printApiResponseClass(outputDir) {
  const file = `
/**
 * A standardized API response object.
 */
export default class ApiResponse {
  constructor(statusCode, body) {
    this.statusCode = statusCode;
    this.body = body;
  }
  
  /**
   *
   * @param res
   * @param apiResponse
   */
  static handleResponseOrError(res, apiResponse) {
    if (!(apiResponse instanceof ApiResponse)) {
      console.log(\`response: \${apiResponse}\`);
      res.status(500).end();
      return;
    }

    res.status(apiResponse.statusCode);
    if (apiResponse.body) {
      res.send(apiResponse.body);
    } else {
      res.end();
    }
  }
}
`;
  fs.writeFileSync(`${outputDir}/ApiResponse.js`, file);
}

function printBaseRouteImplClass(outputDir) {
  const file = `
/**
 * A base template class needed for each implementation of a route.
 */
export default class BaseRouteHandlerImpl {
  async extractCurrentUserId(req, requiresAuth) {
    throw new ApiResponse(501, "Route handler has not implemented extractCurrentUserId functionality");
  }
}
`;
  fs.writeFileSync(`${outputDir}/BaseRouteHandlerImpl.js`, file);
}

function printHandler(path, pathObj, outputFile) {
  const commands = Object.keys(pathObj);
  let implPath = "";
  let rootHandlerPath = "";
  for (let count = 0, depth = path.split('/').length - 1; count < depth; ++count) {
    implPath += "../";
    if (count !== 0) {
      rootHandlerPath += "../";
    }
  }
  if (implPath === "") {
    implPath = "./";
  }
  if (rootHandlerPath === "") {
    rootHandlerPath = "./";
  }
  const data = `
/* eslint-disable */

const optional = require('require-optional');
import ApiResponse from '${rootHandlerPath}ApiResponse';
import BaseRouteHandlerImpl from '${rootHandlerPath}BaseRouteHandlerImpl';
const Impl = optional('${implPath}impl${path}');

module.exports = {
${commands.map((command) => {
    return printCommandFunction(command, requiresAuth(pathObj[command]))
}).join(',\n')}
};`;
  fsExtra.ensureFileSync(outputFile);
  process.stdout.clearLine();
  process.stdout.write(`\rGenerating for ${path}`);
  fs.writeFileSync(outputFile, data);
}

function requiresAuth(commandObj) {
  return commandObj.parameters !== undefined &&
    commandObj.parameters.find(element =>
      element["$ref"] !== undefined && element["$ref"] === "#/parameters/Authorization") !== undefined
}

function printCommandFunction(cmd, requiresAuth) {
  const cmdFun = cmd === "delete" ? "del": cmd;
  return `
  ${cmd}: (req, res) => {
    if (Impl) {
      let impl = new Impl.default();
      if (!(impl instanceof BaseRouteHandlerImpl)) {
        console.log("Handler's implementation must extend BaseRouteHandlerImpl");
        res.status(501).end();
        return;
      }
      impl.extractCurrentUserId(req, ${requiresAuth} /* requiresAuth */)
          .then(currentUserId => impl.${cmdFun}(currentUserId, req))
          .then(response => ApiResponse.handleResponseOrError(res, response))
          .catch(err => ApiResponse.handleResponseOrError(res, err));
    } else {
      res.status(501).end();
    }
  }`;
}

exports.printHandlers = printHandlers;