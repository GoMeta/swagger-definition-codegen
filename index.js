#!/usr/bin/env node

const program = require('commander');
const fs = require('fs');
const path = require('path');

// Parse the command line arguments
program
	.version('1.0.0')
	.usage('[options] <file ...>')
	.option('-o, --output <output>', 'Specify the output directory')
	.parse(process.argv);

if (program.args.length < 1) {
	console.error('You must supply an input.')
	process.exit(1);
}

const input = path.resolve(program.args[0]);
const outputPath = path.resolve(program.output || '.');

const swagger = fs.readFileSync(input, 'utf8');

let definitions;
try {
	const parsedSwagger = JSON.parse(swagger);
	definitions = parsedSwagger.definitions;
} catch (err) {
	console.error('Your Swagger file must be valid JSON.');
	process.exit(1);
}

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

		const file = `/* eslint-disable */

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
		console.log(`Generating for ${definition}`);
		fs.writeFileSync(path.join(outputPath, `${definition}.js`), file);
	});
