// Compile le jeu 3D (assets/js/game) en un seul fichier public/js/game/game.js.
// Usage : npm install puis npm run build:game
import { build } from 'esbuild';
import { rmSync } from 'node:fs';

// Modules Babylon jamais utilisés ici (moteur WebGPU, graphes d'interactivité glTF) :
// remplacés par des modules vides pour alléger fortement le fichier.
const unused = /[\\/]@babylonjs[\\/](core[\\/](ShadersWGSL|FlowGraph[\\/](?!CustomTypes))|materials[\\/].*[\\/]wgsl[\\/]|loaders[\\/]glTF[\\/]2\.0[\\/]Extensions[\\/](KHR_interactivity|KHR_node_))/;

const stripUnused = {
    name: 'strip-unused-babylon',
    setup(b) {
        b.onLoad({ filter: /\.js$/ }, (args) => (unused.test(args.path) ? { contents: 'export {};', loader: 'js' } : undefined));
    },
};

rmSync('public/js/game', { recursive: true, force: true });
await build({
    entryPoints: ['assets/js/game/main.js'],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    outfile: 'public/js/game/game.js',
    plugins: [stripUnused],
    logLevel: 'warning',
});
console.log('public/js/game/game.js compilé.');
