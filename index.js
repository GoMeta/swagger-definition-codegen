#!/usr/bin/env node

const Handlers = require('./lib/handlers');

const program = require('commander');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');

// Parse the command line arguments
program
    .version('1.0.0')
    .usage('[options] <file ...>')
    .option('-o, --output <output>', 'Specify the output directory. Defaults to out')
    .option('-d, --definitions-dir <definitions>', 'Specify the definitions directory. Defaults to definitions/')
    .option('-h, --handlers-dir <handlers>', 'Specify the handlers directory. Defaults to handlers/')
    .parse(process.argv);

if (program.args.length < 1) {
    console.error('You must supply an input.');
    process.exit(1);
}

const startTimestamp = Date.now();

const input = path.resolve(program.args[0]);
const outputPath = path.resolve(program.output || 'out');
const definitionsPath = path.join(outputPath, program.definitions || 'definitions');
const handlersPath = path.join(outputPath, program.handlers || 'handlers');
console.log(`input = ${input}`);
console.log(`outputPath = ${outputPath}`);
console.log(`definitionsPath = ${definitionsPath}`);
console.log(`handlersPath = ${handlersPath}`);

const swagger = fs.readFileSync(input, 'utf8');

let definitions;
let paths;
try {
    const parsedSwagger = JSON.parse(swagger);
    definitions = parsedSwagger.definitions;
    paths = parsedSwagger.paths;
} catch (err) {
    console.error('Your Swagger file must be valid JSON.');
    process.exit(1);
}

console.log("Generating definitions...");
fsExtra.ensureDirSync(definitionsPath);
Object.keys(definitions)
    .filter((definition) => definitions[definition].type === 'object')
    .forEach((definition) => {
        const properties = definitions[definition].properties;

        const keys = Object.keys(properties);

        const docs = keys
            .map((key) => {
                const description = properties[key].description || '';
                return ` * @param ${key}${description.replace(/\n$/, '')}`;
            })
            .join('\n');

        const args = keys
            .join(', ')
            .trim();

        const obj = keys
            .map((key) => `    ${key}: ${key},`)
            .join('\n')
            .trim();

        const file =
`/* eslint-disable */

/**
 * @name ${definition}
 * @class
 */
export default class ${definition} {
  /**
   * Build a ${definition}
   *
   * @memberOf ${definition}
${keys.map((key) => {
    const description = properties[key].description || '';
    return `   * @param ${key} ${description.replace(/\n$/, '')}`
}).join('\n')}
   */
  constructor(${keys.join(', ').trim()}) {
${keys.map((key) => `    this.${key} = ${key};`).join('\n')}
  }

  /**
   * Build a ${definition} from a JSON object
   *
   * @memberOf ${definition}
   * @param json A JSON object
   * @return Instance of ${definition}
   */
  static fromJSON(json) {
    return new ${definition}(${keys.map((key) => `json.${key}`).join(', ').trim()});
  }

  /**
   * Validate a JSON object
   *
   * @memberOf ${definition}
   * @param json A JSON object
   * @return The validated JSON object
   * @throws
   */
  static validate(json) {
    const keys = [${keys.map(key => `'${key}'`).join(', ').trim()}];
    if (Object.keys(json).every(key => keys.includes(key))) {
      return json;
    }

    throw new Error('invalid_json');
  }

  /**
   * The structured object
   *
   * @memberOf ${definition}
   */
  get object() {
    return {
${keys.map((key) => `      ${key}: this.${key},`).join('\n')}
    };
  }
}
`;
        process.stdout.clearLine();
        process.stdout.write(`\rGenerating for ${definition}`);
        fs.writeFileSync(path.join(definitionsPath, `${definition}.js`), file);
    });

process.stdout.clearLine();
process.stdout.cursorTo(0);
Handlers.printHandlers(paths, handlersPath);
console.log(`Finished in ${(Date.now() - startTimestamp)/1000.0} seconds`);