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
    s=re.sub(r'^.*?\\.pose\\(\\)\\.(?:pushMatrix|popMatrix|translate|scale)\\(.*?\\);.*$', '// Transform previously applied by 1.21 GUI pose stack',s,flags=re.M)
    s=s.replace("displayClientMessage(", "sendSystemMessage(")
    s=s.replace("import net.minecraft.client.gui.GuiGraphicsExtractor;", "import net.minecraft.client.gui.GuiGraphicsExtractor;")
    if file.name == "TigerAuctionClient.java":
        s=s.replace("import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;", "")
        s=re.sub(r'\\s*HudElementRegistry\\.addLast\\(.*?\\n\\s*\\);', '\\n', s, flags=re.S)
        s=s.replace("ClientTickEvents.END_CLIENT_TICK", "ClientTickEvents.END_CLIENT_TICK")
        s=s.replace("client.player.sendSystemMessage(Component.literal(message), false);","client.player.sendSystemMessage(Component.literal(message));")
    if file.name=="AuctionControlsScreen.java":
        s=s.replace("GLFW.glfwGetKeyName(", "InputConstants.getKeyName(")
    file.write_text(s)
mod=root/"src/main/resources/fabric.mod.json"
s=mod.read_text().replace('"minecraft": "~1.21.11"', '"minecraft": "26.3"').replace('"minecraft": "1.21.11"', '"minecraft": "26.3"').replace('"java": ">=21"', '"java": ">=25"')
mod.write_text(s)
print("Ported", len(list((root/"src/main/java").rglob("*.java"))), "Java source files")
