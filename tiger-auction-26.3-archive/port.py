#!/usr/bin/env python3
"""Port October 29 TigerAuction sources to Minecraft 26.3 Fabric APIs."""
from pathlib import Path
import re

root=Path(__file__).resolve().parent/"source"
(root/"build.gradle").write_text("""
plugins {
    id 'net.fabricmc.fabric-loom' version '1.18.2'
}
group = project.maven_group
version = project.mod_version
base { archivesName = project.archives_base_name }
dependencies {
    minecraft "com.mojang:minecraft:${project.minecraft_version}"
    implementation "net.fabricmc:fabric-loader:${project.loader_version}"
    implementation "net.fabricmc.fabric-api:fabric-api:${project.fabric_api_version}"
}
java {
    sourceCompatibility = JavaVersion.VERSION_25
    targetCompatibility = JavaVersion.VERSION_25
}
tasks.withType(JavaCompile).configureEach {
    options.release = 25
    options.encoding = 'UTF-8'
}
processResources {
    inputs.property "version", project.version
    filesMatching('fabric.mod.json') { expand "version": project.version }
}
""")
(root/"gradle.properties").write_text("""org.gradle.jvmargs=-Xmx3G
org.gradle.parallel=false
minecraft_version=26.3
loader_version=0.19.5
fabric_api_version=0.165.2+26.3
mod_version=26.3-1.1.9
maven_group=net.tigerfx
archives_base_name=tiger-auction
""")
for file in (root/"src/main/java").rglob("*.java"):
    s=file.read_text()
    s=s.replace("import org.lwjgl.glfw.GLFW;", "")
    s=s.replace("net.minecraft.client.gui.GuiGraphics", "net.minecraft.client.gui.GuiGraphicsExtractor")
    s=s.replace("GuiGraphics ", "GuiGraphicsExtractor ")
    s=s.replace("public void render(GuiGraphicsExtractor ", "public void extractRenderState(GuiGraphicsExtractor ")
    s=s.replace("super.render(", "super.extractRenderState(")
    s=s.replace(".renderItem(", ".item(")
    s=s.replace(".drawString(", ".text(")
    s=s.replace(".drawCenteredString(", ".centeredText(")
    s=s.replace(".setScreen(", ".gui.setScreen(")
    s=s.replace("client.screen == null", "client.gui.screen() == null")
    s=s.replace("client.screen != null", "client.gui.screen() != null")
    s=s.replace("minecraft.screen", "minecraft.gui.screen()")
    s=s.replace("KeyBindingHelper", "KeyMappingHelper")
    s=s.replace("registerKeyBinding", "registerKeyMapping")
    s=s.replace("InputConstants.Type.KEYSYM", "InputConstants.Type.KEYBOARD")
    s=s.replace("GLFW.GLFW_KEY_J", "InputConstants.KEY_J")
    s=s.replace("GLFW.GLFW_KEY_ESCAPE", "InputConstants.KEY_ESCAPE")
    s=s.replace("GLFW.GLFW_KEY_UNKNOWN", "InputConstants.UNKNOWN.getValue()")
    s=s.replace("GLFW.GLFW_KEY_BACKSPACE", "InputConstants.KEY_BACKSPACE")
    s=s.replace("GLFW.GLFW_KEY_DELETE", "InputConstants.KEY_DELETE")
    s=s.replace("GLFW.GLFW_KEY_SPACE", "InputConstants.KEY_SPACE")
    # New extractors do not expose the old mutable pose stack.
    # Matrix3x2fStack transformations remain supported by GuiGraphicsExtractor in 26.3.
    s=s.replace("displayClientMessage(", "sendSystemMessage(")
    s=s.replace("import net.minecraft.client.gui.GuiGraphicsExtractor;", "import net.minecraft.client.gui.GuiGraphicsExtractor;")
    if file.name == "TigerAuctionClient.java":
        s=s.replace("import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;", "")
        # Remove the old HUD registration before adding its 26.3 replacement.
        # The previous transformer left both registrations with the SAME id,
        # which caused Fabric to reject TigerAuction during client startup.
        s=re.sub(r'\s*HudElementRegistry\.addLast\([\s\S]*?\n\s*\);', '\n', s, count=1)
        s=s.replace("ClientTickEvents.END_CLIENT_TICK", "ClientTickEvents.END_CLIENT_TICK")
        s=s.replace("client.player.sendSystemMessage(Component.literal(message), false);","client.player.sendSystemMessage(Component.literal(message));")
    if file.name=="AuctionControlsScreen.java":
        s=s.replace("GLFW.glfwGetKeyName(", "InputConstants.getKeyName(")

    # Fix remaining 26.3 key mapping import and inventory item naming.
    s=s.replace("net.fabricmc.fabric.api.client.keybinding.v1.KeyMappingHelper", "net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper")
    for old in ["active.item","finished.item","item","selectedItem","stackItem"]:
        s=s.replace(old+".getName().getString()", "new ItemStack("+old+").getHoverName().getString()")
    # Player.sendSystemMessage no longer takes an overlay argument in 26.3.
    s=re.sub(r'(\.sendSystemMessage\(\s*Component\.literal\([\s\S]*?\))\s*,\s*(?:true|false)\s*\)',r'\1)',s)
    if file.name == "AuctionLoggingClient.java":
        s=s.replace("import net.minecraft.world.item.Item;", "import net.minecraft.world.item.Item;\nimport net.minecraft.world.item.ItemStack;")
        begin=s.find("        ScreenEvents.AFTER_INIT.register(")
        if begin != -1:
            end=s.find("\n        });", begin)
            if end != -1:
                s=s[:begin]+s[end+len("\n        });"):]
    if file.name == "AuctionScreen.java":
        s=s.replace('addRenderableWidget(Button.builder(Component.literal("CONTROLS")', 
        'addRenderableWidget(Button.builder(Component.literal("AUCTION LOGS"), b -> minecraft.gui.setScreen(new AuctionLogScreen(this)))\n                .bounds(panelX + 230, panelY + 328, 100, 22).build());\n        addRenderableWidget(Button.builder(Component.literal("CONTROLS")')
        s=s.replace("0xFF6AD7FF", "0xFFFFC857").replace("0xFFE3F5FF","0xFFFFE8A5").replace("0xF0111A24","0xF017120A")
    if file.name == "TigerExtras.java":
        s=s.replace("static int theme = 0;", "static int theme = 1;")
    if file.name == "TigerAuctionClient.java":
        s=s.replace('import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;',
            'import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;\nimport net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;\nimport net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;')
        s=s.replace("        ClientTickEvents.END_CLIENT_TICK.register(client -> {", """        HudElementRegistry.attachElementAfter(
            VanillaHudElements.TITLE_AND_SUBTITLE,
            Identifier.fromNamespaceAndPath(MOD_ID, "auction_hud"),
            (graphics, deltaTracker) -> {
                AuctionState.renderHud(graphics);
                TigerExtras.renderHud(graphics);
            }
        );
        ClientTickEvents.END_CLIENT_TICK.register(client -> {""")


    if file.name == "AuctionScreen.java":
        # Restore the five-preset manager and profit ledger entrypoints, in unused
        # space beside the existing "SAVE ITEM" button.
        s=s.replace('        addRenderableWidget(Button.builder(Component.literal("SAVE ITEM")', """
        addRenderableWidget(Button.builder(Component.literal("PRESETS"), b ->
            minecraft.gui.setScreen(new AuctionPresetsScreen(this)))
            .bounds(panelX + 464, panelY + 283, 75, 20).build());
        addRenderableWidget(Button.builder(Component.literal("PROFITS"), b ->
            minecraft.gui.setScreen(new ProfitScreen(this)))
            .bounds(panelX + 544, panelY + 283, 78, 20).build());
        addRenderableWidget(Button.builder(Component.literal("SAVE ITEM")""")
        s=s.replace("    private void startAuction() {", """    private void applyPendingPreset() {
        AuctionPresets.Preset p = AuctionPresets.takePending();
        if (p == null) return;
        for (Item candidate : allItems) {
            if (BuiltInRegistries.ITEM.getKey(candidate).toString().equals(p.id())) {
                selectedItem = candidate;
                break;
            }
        }
        quantity = Math.max(1, Math.min(64, p.quantity()));
        minimumBox.setValue(p.min());
        maximumBox.setValue(p.max());
        durationBox.setValue(p.duration());
        status = "Loaded preset: " + p.label();
    }

    void savePreset(int index) {
        AuctionPresets.save(index,
            BuiltInRegistries.ITEM.getKey(selectedItem).toString(),
            new ItemStack(selectedItem).getHoverName().getString(), quantity,
            minimumBox.getValue(), maximumBox.getValue(), durationBox.getValue());
        status = "Saved auction preset " + (index + 1);
    }

    private void startAuction() {""")
        s=s.replace("    }\n\n    private void startAuction() {",
            "    }\n\n    private void startAuction() {")
        # Apply any selected saved preset after re-entering the auction screen.
        needle="    }\n\n    private void applyPendingPreset() {"
        s=s.replace(needle,"        applyPendingPreset();\n    }\n\n    private void applyPendingPreset() {",1)


    if file.name == "AuctionScreen.java":
        # Restore the exact 1.1.9 preset layout: five inline gold slots,
        # a Save Preset toggle, click-to-load and right-click-to-delete.
        s=s.replace("""        addRenderableWidget(Button.builder(Component.literal("PRESETS"), b ->
            minecraft.gui.setScreen(new AuctionPresetsScreen(this)))
            .bounds(panelX + 464, panelY + 283, 75, 20).build());
""", "")
        s=s.replace(".bounds(panelX + 544, panelY + 283, 78, 20).build());",
                    ".bounds(panelX + 345, panelY + 9, 100, 20).build());")
        s=s.replace(".bounds(panelX + 345, panelY + 283, 115, 20).build());",
                    ".bounds(panelX + 345, panelY + 217, 115, 20).build());")
        s=s.replace("            drawSelectedItem(graphics);",
                    "            drawSelectedItem(graphics);\n            tigerDrawPresetSlots(graphics,panelMouseX,panelMouseY);")
        s=s.replace("        event = scaleMouse(event);",
                    "        event = scaleMouse(event);\n        if (tigerPresetClick(event)) return true;", 1)
        code = """    private boolean tigerSavingPreset;

    private void tigerDrawPresetSlots(GuiGraphicsExtractor g, int mx, int my) {
        int x=panelX+344, y=panelY+248;
        g.fill(x,y,x+278,y+74,0xFF100D08);
        g.fill(x,y,x+278,y+2,0xFFFFC857);
        g.text(font,tigerSavingPreset?"SAVE MODE - CHOOSE A SLOT":"SAVED AUCTIONS / 5 SLOTS",
            x+5,y+5,0xFFFFE8A5);
        int[] xx={348,439,530,348,439};
        int[] yy={280,280,280,301,301};
        int hovered=-1;
        for(int i=0;i<5;i++){
            if(mx>=panelX+xx[i]&&mx<panelX+xx[i]+86&&
               my>=panelY+yy[i]&&my<panelY+yy[i]+18) hovered=i;
        }
        String info=tigerSavingPreset?"CLICK A SLOT TO SAVE / OVERWRITE":
              "CLICK = LOAD  RIGHT-CLICK = CLEAR";
        if(hovered>=0 && !tigerSavingPreset){
            AuctionPresets.Preset p=AuctionPresets.get(hovered);
            if(p!=null) info="x"+p.quantity()+" "+p.min()+"-"+p.max()+" "+p.duration();
        }
        if(info.length()>47) info=info.substring(0,46);
        g.text(font,info,x+5,y+19,0xFFB9A982);
        for(int i=0;i<5;i++){
            int sx=panelX+xx[i],sy=panelY+yy[i];
            g.fill(sx,sy,sx+86,sy+18, hovered==i?0xFFB18F42:0xFF3D3020);
            g.fill(sx+1,sy+1,sx+85,sy+17, hovered==i?0xFF2B2314:0xFF20180D);
            AuctionPresets.Preset p=AuctionPresets.get(i);
            String text=(i+1)+" "+(p==null?"EMPTY":p.label()+" x"+p.quantity());
            if(text.length()>14)text=text.substring(0,13)+"..";
            g.text(font,text,sx+4,sy+5,p==null?0xFF9D9B8B:0xFFFFC857);
        }
        int saveX=panelX+530,saveY=panelY+301;
        g.fill(saveX,saveY,saveX+86,saveY+18,tigerSavingPreset?0xFF705117:0xFF4B3616);
        g.fill(saveX+1,saveY+1,saveX+85,saveY+17,0xFF1D160A);
        g.text(font,tigerSavingPreset?"CANCEL SAVE":"SAVE PRESET",saveX+7,saveY+5,0xFFFFE8A5);
    }

    private boolean tigerPresetClick(MouseButtonEvent e){
        double x=e.x()-panelX,y=e.y()-panelY;
        if(x<344 || x>=622 || y<248 || y>=322) return false;
        if(e.button()!=0 && e.button()!=1)return true;
        if(x>=530 && x<616 && y>=301 && y<319){
            if(e.button()==0) tigerSavingPreset=!tigerSavingPreset;
            return true;
        }
        int[] xx={348,439,530,348,439};
        int[] yy={280,280,280,301,301};
        for(int i=0;i<5;i++) {
            if(x<xx[i] || x>=xx[i]+86 || y<yy[i] || y>=yy[i]+18)continue;
            if(e.button()==1) {
                AuctionPresets.clear(i);
                tigerSavingPreset=false;
                status="Cleared preset slot "+(i+1);
            } else if(tigerSavingPreset) {
                savePreset(i);
                tigerSavingPreset=false;
            } else {
                AuctionPresets.Preset p=AuctionPresets.get(i);
                if(p!=null){
                    AuctionPresets.select(i);
                    applyPendingPreset();
                }else status="Empty preset slot "+(i+1)+". Click SAVE PRESET first.";
            }
            return true;
        }
        return true;
    }

"""
        s=s.replace("    private void startAuction() {", code + "    private void startAuction() {")

    file.write_text(s)
mod=root/"src/main/resources/fabric.mod.json"
s=mod.read_text().replace('"minecraft": "~1.21.11"', '"minecraft": "26.3"').replace('"minecraft": "1.21.11"', '"minecraft": "26.3"').replace('"java": ">=21"', '"java": ">=25"').replace("for Minecraft 1.21.11.", "for Minecraft 26.3.")
mod.write_text(s)
print("Ported", len(list((root/"src/main/java").rglob("*.java"))), "Java source files")

# Add the reconstructed 1.1.9-only modules. This is a direct copy, not a
# text transform, because the new classes already target Minecraft 26.3.
for java_file in (Path(__file__).resolve().parent/"addons").rglob("*.java"):
    relative = java_file.relative_to(Path(__file__).resolve().parent/"addons")
    destination = root/"src/main/java"/relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(java_file.read_text())

# Preserve original entrypoint order and attach the economy ledger listener.
s=mod.read_text()
s=s.replace('"net.tigerfx.tigerauction.TigerFinanceTracker"',
            '"net.tigerfx.tigerauction.TigerFinanceTracker",\n      "net.tigerfx.tigerauction.ProfitHooks"')
mod.write_text(s)
