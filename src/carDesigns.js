// Designs de carroceria: cada carro fica em src/cars/ com as linhas da lataria, zonas de vidro, vãos da
// pintura, rodas, interior e build(ctx) com as peças próprias (faróis, lanternas, para-choques...).
import { kaze180 } from './cars/kaze180.js';
import { seiran } from './cars/seiran.js';
import { tsubame } from './cars/tsubame.js';

export const DESIGNS = { kaze180, seiran, tsubame };
