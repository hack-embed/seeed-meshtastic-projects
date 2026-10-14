import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesProject } from '../docs/search.js';
const project = {title:'Garden sensors', description:'Outdoor telemetry', author:'Alex', categories:['IOT'], devices:['SenseCAP MeshTracker X1'], products:['SenseCAP MeshTracker X1'], tags:['LoRa', 'weather-station'], resources:[{label:'secret label'}]};
test('search combines reviewed metadata with case and separator normalization', () => {
  for (const query of ['X1 LoRa', 'alex outdoor', 'WEATHER_STATION', 'iot garden', '']) assert(matchesProject(project, query));
  for (const query of ['X1 missing', 'secret label', 'mqtt']) assert(!matchesProject(project, query));
});
