import fs from 'fs';
import path from 'path';
import ts from 'typescript';

// ------------------------------------------------------------------------------------
const srcDir = path.resolve(process.argv[2]);
const outputFile = path.resolve(process.argv[3]);

// ------------------------------------------------------------------------------------
const interfaceDeclarations: Array<string> = ['export {}'];
const interfaceNames: Array<string> = [];
const ipcMethods: Array<string> = [];

// ------------------------------------------------------------------------------------
const program = ts.createProgram([path.join(srcDir, 'index.ts')], {
  target: ts.ScriptTarget.ES5,
  module: ts.ModuleKind.CommonJS,
});

const checker = program.getTypeChecker();

// ------------------------------------------------------------------------------------
const processFile = (opts: { filePath: string }) => {
  const { filePath } = opts;
  console.info('[processFile] Processing... | File: %s', filePath);

  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) {
    console.error('[processFile] sourceFile NOT FOUND | File: %s', filePath);
    return;
  }

  ts.forEachChild(sourceFile, node => {
    if (!ts.isClassDeclaration(node) || !node.name) {
      return;
    }

    const className = node.name.text;
    const interfaceName = `I${className}Methods`;
    interfaceNames.push(interfaceName);

    const methodSignatures: string[] = [];
    node.members.forEach(member => {
      if (!ts.isMethodDeclaration(member) || !member.name) {
        return;
      }

      const methodName = (member.name as ts.Identifier).text;
      const ipcMethod = `${className}.${methodName}`;
      ipcMethods.push(ipcMethod);

      const parameters = member.parameters
        .map(param => {
          const paramName = (param.name as ts.Identifier).text;
          const paramType = checker.getTypeAtLocation(param);
          const typeString = checker.typeToString(paramType);
          return `${paramName}: ${typeString}`;
        })
        .join(', ');

      const returnType = checker.getReturnTypeOfSignature(
        checker.getSignatureFromDeclaration(member)!,
      );

      const returnTypeString = checker.typeToString(returnType);
      methodSignatures.push(`\t${methodName}: (${parameters}) => ${returnTypeString};`);
    });

    const interfaceDeclaration = `export interface ${interfaceName} {\n${methodSignatures.join('\n')}\n}`;
    interfaceDeclarations.push(interfaceDeclaration);
  });
};

// ------------------------------------------------------------------------------------
const main = () => {
  console.info('[electron-infra]');

  if (!path.isAbsolute(srcDir)) {
    console.error('[main] srcDir: %s | Required srcDir must be absolute path!', srcDir);
    process.exit(-1);
  }

  if (!path.isAbsolute(outputFile) || !outputFile.endsWith('d.ts')) {
    console.error(
      "[main] outputFile: %s | Required outputFile must be absolute path and name ends with '.d.ts'!",
      outputFile,
    );
    process.exit(-1);
  }

  const files = fs.readdirSync(srcDir);
  if (!files.length) {
    console.error('[main] srcDir: %s | No file to export!', srcDir);
    process.exit(-1);
  }

  files.forEach(file => {
    const filePath = path.join(srcDir, file);
    if (!filePath.endsWith('.ts') || file === 'index.ts') {
      return;
    }

    processFile({ filePath });
  });

  interfaceDeclarations.push(
    `export type TControllerMethods =\n\t| ${interfaceNames.map(el => `keyof ${el}`).join('\n\t| ')}`,
    `export type TIpcMethods =\n\t | ${ipcMethods.map(el => `'${el}'`).join('\n\t| ')}`,
  );

  fs.writeFileSync(outputFile, interfaceDeclarations.join('\n\n'), 'utf8');

  console.info(ipcMethods, interfaceNames);
  console.info(`Generated ${outputFile}`);
};

// ------------------------------------------------------------------------------------
main();

// ts-node ./src/lib/electron/utilities/generate-types.ts ./src/controllers ./interface.d.ts
