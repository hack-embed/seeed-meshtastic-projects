import test from 'node:test';
import assert from 'node:assert/strict';
import { repoPath, extractProject } from '../docs/repo-import.js';
const repo={name:'mesh-tracker',description:'',owner:{login:'maker'},default_branch:'main',html_url:'https://github.com/maker/mesh-tracker',homepage:'https://example.com/docs',topics:['meshtastic','3d-printing'],language:'C++',license:{spdx_id:'MIT'}};
const readme=`<p align="center"><img src="https://img.shields.io/badge/build-passing-green"></p>

# Solar Mesh Tracker

A weatherproof Meshtastic tracker built on the Wio Tracker L1 Pro with a printed enclosure and solar charging.

![Build photo](docs/photo.jpg)

## Getting Started

1. Print the enclosure from the \`stl/\` folder.
2. Flash the [firmware](https://flasher.meshtastic.org) with PlatformIO.

\`\`\`sh
pio run -t upload
\`\`\`

### Tips
Keep the antenna vertical.

## License
MIT`;
test('repository links are normalized and non-GitHub hosts rejected',()=>{
 assert.equal(repoPath('github.com/maker/mesh-tracker.git'),'/maker/mesh-tracker');
 assert.equal(repoPath('https://github.com/maker/mesh-tracker/tree/main/docs'),'/maker/mesh-tracker');
 for(const bad of ['https://gitlab.com/maker/x','https://github.com/maker','https://user:pw@github.com/a/b','not a url']) assert.equal(repoPath(bad),'');
});
test('README content maps to submission fields',()=>{
 const d=extractProject(repo,readme,'/maker/mesh-tracker');
 assert.equal(d.title,'Solar Mesh Tracker'); assert.equal(d.author,'maker');
 assert.match(d.description,/^A weatherproof Meshtastic tracker/);
 assert.equal(d.image,'https://raw.githubusercontent.com/maker/mesh-tracker/main/docs/photo.jpg');
 assert.deepEqual(d.hardware,['Wio Tracker L1 Pro']);
 assert(d.categories.includes('3D Prints & Enclosures'));
 assert.deepEqual(d.setup,['Print the enclosure from the stl/ folder.','Flash the firmware (https://flasher.meshtastic.org) with PlatformIO.','pio run -t upload','Tips','Keep the antenna vertical.']);
 assert.deepEqual(d.resources,['https://github.com/maker/mesh-tracker','https://example.com/docs']); assert.equal(d.license,'MIT');
});
test('missing README falls back to metadata and never emits reserved headings',()=>{
 const d=extractProject({...repo,description:'### Injected heading that is long enough to use'},'','/maker/mesh-tracker');
 assert.equal(d.title,'mesh-tracker'); assert(!/^###/m.test(d.description)); assert.deepEqual(d.setup,[]);
 assert.equal(d.image,'https://opengraph.githubassets.com/1/maker/mesh-tracker'); assert.equal(d.imageFromReadme,false);
});
