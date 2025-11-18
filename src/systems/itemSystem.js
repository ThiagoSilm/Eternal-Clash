// src/systems/itemSystem.js
//--------------------------------------------------------------
// ITEM SYSTEM EXPANDIDO
//--------------------------------------------------------------
import { getShopCatalog } from "./shopSystem.js";
import { addEnergy, addGold, addXP } from "./economySystem.js";

//--------------------------------------------------------------
// BUFF CORE
//--------------------------------------------------------------
function addBuff(user, type, multiplier, duration) {
    if (!user.buffs) user.buffs = {};
    user.buffs[type] ??= [];
    user.buffs[type].push({ multiplier, duration });
}

export function updateBuffsAfterBattle(user) {
    if (!user.buffs) return;
    for (const type in user.buffs) {
        user.buffs[type] = user.buffs[type].filter(b => (--b.duration) > 0);
    }
}

export function getActiveMultiplier(user, type) {
    if (!user.buffs?.[type]) return 1;
    return user.buffs[type].reduce((a, b) => a * b.multiplier, 1);
}

//--------------------------------------------------------------
// EQUIPAMENTOS
//--------------------------------------------------------------
export function equipItem(user, itemId) {
    const catalog = getShopCatalog();
    const meta = catalog.find(i => i.id === itemId);
    if (!meta || meta.type !== "equipment") throw new Error("Item não é equipável.");

    if (!user.items?.[itemId]) throw new Error("Você não possui esse item.");
    if (!user.equipment) user.equipment = {};

    user.equipment[meta.slot] = itemId;
    return `🔧 Você equipou **${meta.name}** no slot *${meta.slot}*.`;
}

export function getEquippedStats(user) {
    if (!user.equipment) return { atk: 0, def: 0, hp: 0 };
    const catalog = getShopCatalog();

    return Object.values(user.equipment).reduce((acc, itemId) => {
        const it = catalog.find(i => i.id === itemId);
        if (it?.stats) {
            acc.atk += it.stats.atk || 0;
            acc.def += it.stats.def || 0;
            acc.hp  += it.stats.hp  || 0;
        }
        return acc;
    }, { atk:0, def:0, hp:0 });
}

//--------------------------------------------------------------
// INVENTÁRIO
//--------------------------------------------------------------
export function listUserItems(user) {
    const items = user.items || {};
    if (!Object.keys(items).length) return "Seu inventário está vazio.";

    const catalog = getShopCatalog();
    let out = "🎒 **Inventário:**\n---";

    for (const id in items) {
        const meta = catalog.find(i => i.id === id);
        out += `\n**${meta?.name || id}** — x${items[id]}`;
    }
    return out;
}

//--------------------------------------------------------------
// USO DE ITENS
//--------------------------------------------------------------
export function consumeItem(user, identifier, qty = 1) {
    const catalog = getShopCatalog();
    const meta = catalog.find(i =>
        i.id === identifier || i.name.toLowerCase().includes(identifier.toLowerCase())
    );
    if (!meta) throw new Error("Item não encontrado.");
    if (!user.items?.[meta.id]) throw new Error("Você não tem esse item.");
    if ((user.items[meta.id] ?? 0) < qty) throw new Error("Quantidade insuficiente.");

    if (!["consumable", "buff"].includes(meta.type))
        throw new Error("Esse item não é consumível.");

    let msg = `Usou ${qty}x **${meta.name}**:\n`;
    for (let i = 0; i < qty; i++) msg += applyEffect(user, meta.effect) + "\n";

    user.items[meta.id] -= qty;
    if (user.items[meta.id] <= 0) delete user.items[meta.id];

    return msg.trim();
}

function applyEffect(user, eff) {
    if (!eff) return "Sem efeito.";

    switch (eff.resource) {
        case "energy": addEnergy(user, eff.amount); return `⚡ +${eff.amount} energia.`;
        case "gold":   addGold(user, eff.amount);   return `💰 +${eff.amount} ouro.`;
        case "xp":     addXP(user, eff.amount);     return `✨ +${eff.amount} XP.`;

        case "towerAttempt":
            user.tower ??= { attempts: 0, floor: 1 };
            user.tower.attempts += eff.amount;
            return `🏰 +${eff.amount} tentativa de torre.`;

        case "xp_multiplier":
        case "attack_multiplier":
        case "defense_multiplier":
            addBuff(user, eff.resource.replace("_multiplier",""), eff.multiplier, eff.duration);
            return `🔥 Buff ${eff.resource} ativado.`;

        default: return `Efeito desconhecido: ${eff.resource}`;
    }
}