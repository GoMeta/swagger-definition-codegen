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

// Resolve paths
const input = path.resolve(program.args[0]);
const outputPath = path.resolve(program.output || '.');

// Load the Swagger file
const swagger = fs.readFileSync(input, 'utf8');

// Attempt to parse JSON
let definitions;
try {
	const parsedSwagger = JSON.parse(swagger);
	definitions = parsedSwagger.definitions;
} catch (err) {
	console.error('Your Swagger file must be valid JSON.');
	process.exit(1);
}

Object.keys(definitions)
	.filter((definition) => definitions[definition].type === 'object') // Remove non-object definitions
	.forEach((definition) => {
		const properties = definitions[definition].properties;

		const keys = Object.keys(properties);

		// Map keys to javadoc params
		const docs = keys
			.map((key) => ` * @param ${key} ${properties[key].description.replace(/\n$/, '')}`)
			.join('\n');

		// Generate function arguments
		const args = keys
			.join(', ')
			.trim();

		// Generate explicit object map
		const obj = keys
			.map((key) => `    ${key}: ${key},`)
			.join('\n')
			.trim();

		// Generate constructor code
		const file = `
/* eslint-disable object-shorthand, camelcase */

/**
 * @name ${definition}
${docs}
 */
export default function ${definition}(${args}) {
  return {
    ${obj}
  };
}
`;
		
		// Write the generated file
		console.log(`Generating for ${definition}`);
		fs.writeFileSync(path.join(outputPath, `${definition}.js`), file);
	});
