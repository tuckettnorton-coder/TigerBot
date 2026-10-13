import { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';

function parseNbt(input) {
  const data = gunzipSync(input);
  let p = 0;
  const take = n => { if (p + n > data.length) throw new Error('Schematic data is truncated.'); const b = data.subarray(p, p + n); p += n; return b; };
  const u8 = () => take(1).readUInt8(0);
  const i16 = () => take(2).readInt16BE(0);
  const u16 = () => take(2).readUInt16BE(0);
  const i32 = () => take(4).readInt32BE(0);
  const i64 = () => take(8).readBigInt64BE(0);
  const str = () => take(u16()).toString('utf8');
  function value(t) {
    switch (t) {
      case 1: return take(1).readInt8(0);
      case 2: return i16();
      case 3: return i32();
      case 4: return i64();
      case 5: return take(4).readFloatBE(0);
      case 6: return take(8).readDoubleBE(0);
      case 7: { const n = i32(); if (n < 0 || n > data.length) throw new Error('Invalid NBT byte array.'); return take(n); }
      case 8: return str();
      case 9: { const et = u8(), n = i32(); if (n < 0 || n > 2000000) throw new Error('NBT list is too large.'); return Array.from({ length: n }, () => value(et)); }
      case 10: { const o = {}; while (true) { const et = u8(); if (!et) break; o[str()] = value(et); } return o; }
      case 11: { const n = i32(); if (n < 0 || n > 2000000) throw new Error('Invalid NBT int array.'); return Array.from({ length: n }, i32); }
      case 12: { const n = i32(); if (n < 0 || n > 2000000) throw new Error('Invalid NBT long array.'); return Array.from({ length: n }, i64); }
      default: throw new Error('Unsupported NBT tag type ' + t);
    }
  }
  if (u8() !== 10) throw new Error('File is not a supported NBT schematic.');
  str();
  return value(10);
}

function decodeStates(raw, paletteSize, volume) {
  const bits = Math.max(2, Math.ceil(Math.log2(Math.max(2, paletteSize))));
  const mask = (1n << BigInt(bits)) - 1n;
  const longs = raw || [];
  const compactLen = Math.ceil(volume * bits / 64);
  const perLong = Math.floor(64 / bits);
  const paddedLen = Math.ceil(volume / perLong);
  const padded = longs.length === paddedLen && longs.length !== compactLen;
  const result = new Uint32Array(volume);
  for (let i = 0; i < volume; i++) {
    let v;
    if (padded) {
      v = Number((BigInt.asUintN(64, longs[Math.floor(i / perLong)] || 0n) >> BigInt((i % perLong) * bits)) & mask);
    } else {
      const bit = BigInt(i) * BigInt(bits);
      const li = Number(bit / 64n), shift = bit % 64n;
      let packed = BigInt.asUintN(64, longs[li] || 0n) >> shift;
      if (shift + BigInt(bits) > 64n) packed |= BigInt.asUintN(64, longs[li + 1] || 0n) << (64n - shift);
      v = Number(packed & mask);
    }
    result[i] = v < paletteSize ? v : 0;
  }
  return result;
}

function blockColor(name) {
  const n = name.replace(/^minecraft:/, '');
  const groups = [
    [/glass|ice/, '#b5e7f7'], [/water/, '#397bc4'], [/grass|moss|leaves|vine/, '#648d45'],
    [/dirt|mud|podzol/, '#79553c'], [/stone|deepslate|cobble|andesite|diorite|granite|tuff|bedrock/, '#85888a'],
    [/sand|sandstone|end_stone/, '#d5c58a'], [/oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo|planks|log|wood|chest|barrel/, '#a47b4d'],
    [/iron|hopper|anvil|rail|chain|piston|dispenser|observer|dropper/, '#9da2a5'], [/redstone|repeater|comparator|lever|torch/, '#b9433f'],
    [/gold/, '#e0b83f'], [/diamond/, '#54d6cb'], [/emerald/, '#42a65b'], [/copper/, '#bd784e'],
    [/brick|terracotta|magma/, '#a35e4a'], [/obsidian|blackstone/, '#393344'], [/snow|quartz|white_concrete/, '#e4e3dd']
  ];
  for (const [re, color] of groups) if (re.test(n)) return color;
  return '#a8a8a8';
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [16, 8, 0].map(s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f))).toString(16).padStart(2, '0')).join('');
}
function xml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]); }

function analyze(buffer) {
  const root = parseNbt(buffer), regions = root.Regions;
  if (!regions || typeof regions !== 'object') throw new Error('No Litematica regions found.');
  const counts = new Map(), blocks = [];
  let total = 0, maxX = 0, maxY = 0, maxZ = 0;
  for (const region of Object.values(regions)) {
    const sx = Math.abs(Number(region.Size?.x || 0)), sy = Math.abs(Number(region.Size?.y || 0)), sz = Math.abs(Number(region.Size?.z || 0));
    if (!sx || !sy || !sz || sx * sy * sz > 5000000) throw new Error('Invalid or excessively large region dimensions.');
    maxX = Math.max(maxX, sx); maxY = Math.max(maxY, sy); maxZ = Math.max(maxZ, sz);
    const palette = region.BlockStatePalette;
    if (!Array.isArray(palette) || !palette.length) throw new Error('A region has no block palette.');
    const names = palette.map(v => typeof v.Name === 'string' ? v.Name : 'minecraft:unknown');
    const volume = sx * sy * sz, states = decodeStates(region.BlockStates, names.length, volume);
    for (let i = 0; i < volume; i++) {
      const name = names[states[i]] || names[0];
      if (/^(minecraft:)?(air|cave_air|void_air)$/.test(name)) continue;
      total++;
      counts.set(name, (counts.get(name) || 0) + 1);
      if (blocks.length < 100000) blocks.push({ x: i % sx, y: Math.floor(i / sx) % sy, z: Math.floor(i / (sx * sy)), color: blockColor(name) });
    }
  }
  return { name: root.Metadata?.Name || 'Minecraft Schematic', size: [maxX, maxY, maxZ], total, counts: [...counts].sort((a, b) => b[1] - a[1]), blocks };
}

function makeSvg(data) {
  const [sx, sy, sz] = data.size, W = 1200, H = 1200;
  const unit = Math.max(3, Math.min(12, Math.floor(700 / (sx + sz + sy * 0.7))));
  const half = unit / 2;
  const pt = (x, y, z) => [W / 2 + (x - z) * half, 145 + (x + z) * half - y * unit];
  const stride = Math.max(1, Math.ceil(data.blocks.length / 18000));
  const faces = [];
  for (let i = 0; i < data.blocks.length; i += stride) {
    const b = data.blocks[i], x = b.x, y = b.y, z = b.z, c = b.color;
    const a = pt(x,y+1,z), d = pt(x+1,y+1,z), e = pt(x+1,y+1,z+1), f = pt(x,y+1,z+1);
    const g = pt(x+1,y,z), h = pt(x+1,y,z+1), j = pt(x,y,z+1);
    const poly = ps => ps.map(q => q.map(v => v.toFixed(1)).join(',')).join(' ');
    faces.push({ k: x + z + y * 0.01, svg:
      '<polygon points="' + poly([d,e,h,g]) + '" fill="' + shade(c,.70) + '" stroke="#222329" stroke-opacity=".2" stroke-width=".4"/>' +
      '<polygon points="' + poly([f,e,h,j]) + '" fill="' + shade(c,.84) + '" stroke="#222329" stroke-opacity=".2" stroke-width=".4"/>' +
      '<polygon points="' + poly([a,d,e,f]) + '" fill="' + c + '" stroke="#222329" stroke-opacity=".2" stroke-width=".4"/>' });
  }
  faces.sort((a,b) => a.k - b.k);
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' +
    '<rect width="100%" height="100%" fill="#222329"/>' +
    '<text x="42" y="54" fill="#fff" font-family="Arial" font-size="28" font-weight="bold">' + xml(data.name.slice(0,60)) + '</text>' +
    '<text x="42" y="88" fill="#c5c6cf" font-family="Arial" font-size="18">' + sx + ' × ' + sy + ' × ' + sz + ' blocks • ' + data.total.toLocaleString('en-US') + ' non-air blocks</text>' +
    faces.map(f => f.svg).join('') +
    '<text x="42" y="1168" fill="#c5c6cf" font-family="Arial" font-size="15">TigerBot preview • simplified block colors, not original Minecraft textures</text></svg>';
}

export default {
  data: new SlashCommandBuilder()
    .setName('render')
    .setDescription('Render a Minecraft Litematica schematic and list materials')
    .addAttachmentOption(option => option.setName('file').setDescription('A .litematic file').setRequired(true)),
  async execute(interaction) {
    const file = interaction.options.getAttachment('file', true);
    if (!/\.litematic$/i.test(file.name)) return interaction.reply({ content: '❌ /render currently supports .litematic files only.', ephemeral: true });
    if (file.size > 8 * 1024 * 1024) return interaction.reply({ content: '❌ Maximum schematic upload size is 8 MB.', ephemeral: true });
    await interaction.deferReply();
    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error('Failed to download the uploaded file.');
      const data = analyze(Buffer.from(await response.arrayBuffer()));
      const png = await sharp(Buffer.from(makeSvg(data))).png().toBuffer();
      const attachment = new AttachmentBuilder(png, { name: 'schematic-render.png' });
      const materials = data.counts.slice(0, 20).map(([name, count]) => '• ' + name.replace(/^minecraft:/, '') + ': **' + count.toLocaleString('en-US') + '**').join('\n');
      const extra = data.counts.length > 20 ? '\n…and ' + (data.counts.length - 20) + ' other block types.' : '';
      const embed = new EmbedBuilder()
        .setTitle('🧱 ' + data.name.slice(0, 240))
        .setDescription('**Dimensions:** ' + data.size.join(' × ') + ' blocks\n**Non-air blocks:** ' + data.total.toLocaleString('en-US') + '\n**Block types:** ' + data.counts.length + '\n\n**Materials list**\n' + (materials || 'No blocks found.') + extra)
        .setImage('attachment://schematic-render.png')
        .setFooter({ text: 'Preview uses simplified block colors; material counts are read from the file.' });
      return interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error) {
      return interaction.editReply('❌ Could not render this schematic: ' + error.message);
    }
  }
};
