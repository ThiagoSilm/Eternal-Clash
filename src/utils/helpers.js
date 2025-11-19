// src/systems/utils/helpers.js

export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function chance(probability) {
    return Math.random() < probability;
}

// Função necessária para deep clone seguro de objetos
export function deepCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
}