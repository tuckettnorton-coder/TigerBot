package net.tigerfx.tigerauction;

import net.fabricmc.loader.api.FabricLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/** Same seven-column TSV format as TigerAuction 1.1.9, so five existing presets load unchanged. */
public final class AuctionPresets {
    public record Preset(String id, String label, int quantity, String min, String max, String duration) {}
    private static final int COUNT = 5;
    private static final Preset[] slots = new Preset[COUNT];
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("tigerauction-presets.tsv");
    private static boolean loaded;
    private static Preset pending;

    private AuctionPresets() {}
    private static String enc(String s) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }
    private static String dec(String s) {
        return new String(Base64.getUrlDecoder().decode(s), StandardCharsets.UTF_8);
    }
    public static synchronized void load() {
        if (loaded) return;
        loaded = true;
        try {
            if (!Files.isRegularFile(FILE)) return;
            for (String line : Files.readAllLines(FILE, StandardCharsets.UTF_8)) {
                try {
                    String[] p = line.split("\t", -1);
                    if (p.length != 7) continue;
                    int slot = Integer.parseInt(p[0]), quantity = Integer.parseInt(p[3]);
                    if (slot < 0 || slot >= COUNT || quantity < 1 || quantity > 64) continue;
                    String id = dec(p[1]), label = dec(p[2]), min = dec(p[4]),
                           max = dec(p[5]), duration = dec(p[6]);
                    if (id.isBlank() || min.isBlank() || max.isBlank() || duration.isBlank()) continue;
                    slots[slot] = new Preset(id, label, quantity, min, max, duration);
                } catch (RuntimeException ignored) {}
            }
        } catch (Exception ex) {
            System.err.println("[TigerAuction] Could not load presets: " + ex.getMessage());
        }
    }
    public static synchronized Preset get(int slot) {
        load();
        return slot < 0 || slot >= COUNT ? null : slots[slot];
    }
    public static synchronized int occupied() {
        load(); int count=0; for(Preset preset : slots) if(preset!=null) count++; return count;
    }
    public static synchronized void save(int slot, String id, String label, int qty,
                                          String min, String max, String duration) {
        load(); if(slot<0||slot>=COUNT||id==null||id.isBlank()) return;
        slots[slot] = new Preset(id,label,Math.max(1,Math.min(64,qty)),min,max,duration);
        persist();
    }
    public static synchronized void clear(int slot) {
        load(); if(slot<0||slot>=COUNT)return;
        slots[slot] = null; persist();
    }
    public static synchronized void select(int slot) { pending = get(slot); }
    public static synchronized Preset takePending() {
        Preset r = pending; pending=null; return r;
    }
    private static synchronized void persist() {
        try {
            Files.createDirectories(FILE.getParent());
            List<String> lines = new ArrayList<>();
            for(int i=0;i<COUNT;i++){
                Preset p=slots[i];
                if(p!=null) lines.add(i+"\t"+enc(p.id)+"\t"+enc(p.label)+"\t"+p.quantity
                     +"\t"+enc(p.min)+"\t"+enc(p.max)+"\t"+enc(p.duration));
            }
            Path tmp=FILE.resolveSibling(FILE.getFileName()+".tmp");
            Files.write(tmp, lines, StandardCharsets.UTF_8);
            try { Files.move(tmp,FILE,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE); }
            catch(AtomicMoveNotSupportedException ex){Files.move(tmp,FILE,StandardCopyOption.REPLACE_EXISTING);}
        } catch(Exception ex){System.err.println("[TigerAuction] Could not save presets: "+ex.getMessage());}
    }
}
