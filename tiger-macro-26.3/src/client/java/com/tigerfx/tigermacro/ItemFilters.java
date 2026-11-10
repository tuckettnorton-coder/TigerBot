package com.tigerfx.tigermacro;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.world.item.ItemStack;
import net.minecraft.core.registries.BuiltInRegistries;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.util.*;

public final class ItemFilters {
    private static final Path DIR = FabricLoader.getInstance().getConfigDir();
    private static final Path BLACKLIST_FILE = DIR.resolve("tiger-macro-blacklist.txt");
    private static final Path WHITELIST_FILE = DIR.resolve("tiger-macro-whitelist.txt");
    private static final Path MODE_FILE = DIR.resolve("tiger-macro-filter-mode.txt");
    private static final Set<String> BLACKLIST = new LinkedHashSet<>();
    private static final Set<String> WHITELIST = new LinkedHashSet<>();
    private static boolean loaded;
    private static boolean whitelistMode;
    private ItemFilters() {}

    public static synchronized void load() {
        if (loaded) return;
        loaded = true;
        if (Files.exists(BLACKLIST_FILE)) BLACKLIST.addAll(read(BLACKLIST_FILE));
        else {
            BLACKLIST.addAll(List.of("minecraft:elytra","#armor","minecraft:bucket","minecraft:water_bucket","minecraft:lava_bucket"));
            save(BLACKLIST_FILE, BLACKLIST);
        }
        WHITELIST.addAll(read(WHITELIST_FILE));
        try { whitelistMode = Files.readString(MODE_FILE).trim().equalsIgnoreCase("whitelist"); }
        catch (Exception ignored) { whitelistMode = false; }
    }

    private static Set<String> read(Path file) {
        Set<String> result = new LinkedHashSet<>();
        try {
            if (Files.exists(file)) for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                String item = normalize(line);
                if (item != null) result.add(item);
            }
        } catch (Exception ignored) {}
        return result;
    }

    private static void save(Path file, Collection<String> values) {
        try {
            Files.createDirectories(file.getParent());
            Path tmp = Files.createTempFile(file.getParent(), ".tigermacro-", ".tmp");
            try {
                Files.write(tmp, values, StandardCharsets.UTF_8);
                try { Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
                catch (AtomicMoveNotSupportedException ex) { Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING); }
            } finally { Files.deleteIfExists(tmp); }
        } catch (IOException ex) { System.err.println("[TigerMacro] Filter save failed: " + ex.getMessage()); }
    }

    private static String normalize(String input) {
        if (input == null) return null;
        String key = input.trim().toLowerCase(Locale.ROOT).replace(' ','_');
        if (key.isEmpty()) return null;
        if (key.equals("armor") || key.equals("all_armor") || key.equals("#armor")) return "#armor";
        if (!key.contains(":")) key = "minecraft:" + key;
        return key.matches("[a-z0-9_.-]+:[a-z0-9_./-]+") ? key : null;
    }

    public static synchronized boolean isWhitelistMode() { load(); return whitelistMode; }
    public static synchronized void toggleMode() {
        load();
        whitelistMode = !whitelistMode;
        save(MODE_FILE, List.of(whitelistMode ? "whitelist" : "blacklist"));
        MacroController.reset();
    }
    public static synchronized List<String> all() { load(); return new ArrayList<>(whitelistMode ? WHITELIST : BLACKLIST); }
    public static synchronized boolean has(String id) {
        load(); String k = normalize(id);
        return k != null && (whitelistMode ? WHITELIST : BLACKLIST).contains(k);
    }
    public static synchronized void toggle(String id) {
        load(); String k = normalize(id); if (k == null) return;
        Set<String> set = whitelistMode ? WHITELIST : BLACKLIST;
        if (!set.remove(k)) set.add(k);
        save(whitelistMode ? WHITELIST_FILE : BLACKLIST_FILE, set);
        MacroController.reset();
    }
    public static synchronized boolean allowsHeldItem(Minecraft mc) {
        load();
        if (mc.player == null) return false;
        ItemStack stack = mc.player.getMainHandItem();
        String id = stack.isEmpty() ? "" : BuiltInRegistries.ITEM.getKey(stack.getItem()).toString();
        Set<String> selected = whitelistMode ? WHITELIST : BLACKLIST;
        boolean match = selected.contains(id) || (selected.contains("#armor") && isArmor(id));
        return whitelistMode ? match : !match;
    }
    private static boolean isArmor(String id) {
        return id.endsWith("_helmet") || id.endsWith("_chestplate") || id.endsWith("_leggings") || id.endsWith("_boots");
    }
}
