import fs from 'node:fs';
import path from 'node:path';
import { frontendDirectory } from './constants.mjs';
export function buildVersion() {
 try {const {commit,dirty,builtAt}=JSON.parse(fs.readFileSync(path.join(frontendDirectory,'version.json'),'utf8'));return {commit,dirty,builtAt};}
 catch {return {commit:'unknown',dirty:null,builtAt:null};}
}
