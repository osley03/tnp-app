import test from 'node:test';
import assert from 'node:assert/strict';
import { unreachableRooms } from '../src/modules/virtual-tours/lib/walkthrough.ts';

const room = (id, links = []) => ({ id, name: id, settings: { hotspots: links.map(targetSceneId => ({ kind: 'scene', targetSceneId })) } });
const tour = scenes => ({ settings: { startSceneId: 'Entrance' }, scenes });
test('one room needs no doorway', () => assert.deepEqual(unreachableRooms(tour([room('Entrance')])), []));
test('rooms must have a path from and back to entrance', () => {
  assert.deepEqual(unreachableRooms(tour([room('Entrance', ['Kitchen']), room('Kitchen')])), ['Kitchen']);
  assert.deepEqual(unreachableRooms(tour([room('Entrance'), room('Kitchen', ['Entrance'])])), ['Kitchen']);
  assert.deepEqual(unreachableRooms(tour([room('Entrance', ['Kitchen']), room('Kitchen', ['Entrance']), room('Bedroom')])), ['Bedroom']);
});
test('multi-room cycles are walkable without direct entrance links', () => {
  assert.deepEqual(unreachableRooms(tour([room('Entrance', ['Kitchen']), room('Kitchen', ['Bedroom']), room('Bedroom', ['Entrance'])])), []);
});
test('information hotspots cannot make an unreachable room walkable', () => {
  const entrance = room('Entrance'); entrance.settings.hotspots.push({ kind: 'info', targetSceneId: 'Kitchen' });
  assert.deepEqual(unreachableRooms(tour([entrance, room('Kitchen', ['Entrance'])])), ['Kitchen']);
});

import {validateDocument} from '../src/modules/virtual-tours/lib/model.ts';
test('published room tours need return paths while draft editing remains possible',()=>{const room=id=>({id,name:id,settings:{hotspots:[]}});const doc={title:'Room tour',is_published:false,settings:{startSceneId:'entrance'},scenes:[room('entrance'),room('kitchen')]};assert.deepEqual(validateDocument(doc),[]);doc.is_published=true;assert.ok(validateDocument(doc).some(e=>e.includes('return arrows')));doc.scenes[0].settings.hotspots=[{kind:'scene',targetSceneId:'kitchen',label:'Kitchen'}];doc.scenes[1].settings.hotspots=[{kind:'scene',targetSceneId:'entrance',label:'Entrance'}];assert.deepEqual(validateDocument(doc),[]);});
