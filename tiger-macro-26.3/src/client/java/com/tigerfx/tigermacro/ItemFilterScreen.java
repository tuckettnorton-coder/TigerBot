package com.tigerfx.tigermacro;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import java.util.*;
import java.util.stream.Collectors;

/**
 * In-game searchable item browser with actual item icons, a saved selected-items
 * page, and independent persistent BLACKLIST / WHITELIST modes.
 */
public final class ItemFilterScreen extends Screen {
    private static final int COLUMNS=10, ROWS=4, PER_PAGE=COLUMNS*ROWS;
    private final Screen parent;
    private final List<Item> allItems = new ArrayList<>();
    private final List<Button> slots = new ArrayList<>();
    private final List<Item> visibleItems = new ArrayList<>();
    private int page;
    private boolean selectedTab;
    private String search = "";
    private EditBox searchBox;
    private Button modeButton, pageLabel, armorButton, tabButton;
    private final List<String> selectedIds = new ArrayList<>();

    public ItemFilterScreen(Screen parent) {
        super(Component.literal("Tiger Macro - Item Filter"));
        this.parent=parent;
        for (Item item : BuiltInRegistries.ITEM) {
            ItemStack stack = new ItemStack(item);
            if (!stack.isEmpty()) allItems.add(item);
        }
        allItems.sort(Comparator.comparing(item -> new ItemStack(item).getHoverName().getString().toLowerCase(Locale.ROOT)));
    }

    @Override protected void init() {
        int cx=width/2, top=Math.max(26,height/2-104);
        modeButton = addRenderableWidget(Button.builder(Component.literal(modeText()), b -> {
            ItemFilters.toggleMode(); page=0; refresh(); b.setMessage(Component.literal(modeText()));
        }).bounds(cx-198,top,123,20).build());
        tabButton = addRenderableWidget(Button.builder(Component.literal(selectedTab?"SELECTED ITEMS":"SEARCH ITEMS"), b -> {
            selectedTab=!selectedTab; page=0; refresh();
        }).bounds(cx-69,top,130,20).build());
        addRenderableWidget(Button.builder(Component.literal("Done"), b -> onClose())
            .bounds(cx+67,top,129,20).build());
        searchBox=addRenderableWidget(new EditBox(font,cx-198,top+26,396,20,Component.literal("Search item by name or ID")));
        searchBox.setMaxLength(128);
        searchBox.setValue(search);
        searchBox.setResponder(s->{ search=s;page=0;refresh(); });
        armorButton=addRenderableWidget(Button.builder(Component.literal("Armor: toggle"),b->{
            ItemFilters.toggle("#armor"); refresh();
        }).bounds(cx-198,top+52,115,20).build());
        addRenderableWidget(Button.builder(Component.literal("< Prev"),b->{
            page=Math.max(0,page-1); refresh();
        }).bounds(cx-76,top+52,65,20).build());
        pageLabel=addRenderableWidget(Button.builder(Component.literal("Page"),b->{})
            .bounds(cx-7,top+52,74,20).build());
        pageLabel.active=false;
        addRenderableWidget(Button.builder(Component.literal("Next >"),b->{
            page++;refresh();
        }).bounds(cx+71,top+52,125,20).build());

        int left=cx-(COLUMNS*25)/2, gridTop=top+80;
        for(int i=0;i<PER_PAGE;i++){
            final int slot=i;
            Button btn=addRenderableWidget(Button.builder(Component.empty(),b->{
                if(slot>=visibleItems.size())return;
                Item item=visibleItems.get(slot);
                String key=BuiltInRegistries.ITEM.getKey(item).toString();
                ItemFilters.toggle(key); refresh();
            }).bounds(left+(i%COLUMNS)*25,gridTop+(i/COLUMNS)*25,23,23).build());
            slots.add(btn);
        }
        refresh();
    }

    private String modeText() {
        return ItemFilters.isWhitelistMode()?"WHITELIST":"BLACKLIST";
    }
    private void refresh() {
        if(modeButton==null) return;
        modeButton.setMessage(Component.literal(modeText()));
        tabButton.setMessage(Component.literal(selectedTab?"SELECTED ITEMS":"SEARCH ITEMS"));
        armorButton.setMessage(Component.literal((ItemFilters.has("#armor")?"[X] ":"[ ] ")+"ALL ARMOR"));
        String needle=search.toLowerCase(Locale.ROOT).trim();
        List<Item> filtered=new ArrayList<>();
        Set<String> selected=new HashSet<>(ItemFilters.all());
        for(Item item:allItems){
            String id=BuiltInRegistries.ITEM.getKey(item).toString();
            if(selectedTab && !selected.contains(id))continue;
            String name=new ItemStack(item).getHoverName().getString().toLowerCase(Locale.ROOT);
            if(!needle.isEmpty()&&!id.toLowerCase(Locale.ROOT).contains(needle)&&!name.contains(needle))continue;
            filtered.add(item);
        }
        int maxPage=Math.max(0,(filtered.size()-1)/PER_PAGE);
        page=Math.min(page,maxPage);
        int start=page*PER_PAGE;
        visibleItems.clear();
        visibleItems.addAll(filtered.subList(Math.min(start,filtered.size()), Math.min(start+PER_PAGE,filtered.size())));
        for(int i=0;i<slots.size();i++){
            Button btn=slots.get(i);
            btn.visible=i<visibleItems.size();
            if(btn.visible) {
                String id=BuiltInRegistries.ITEM.getKey(visibleItems.get(i)).toString();
                btn.setMessage(Component.literal(selected.contains(id)?"*":""));
            }
        }
        pageLabel.setMessage(Component.literal((page+1)+" / "+(maxPage+1)));
    }
    @Override public void extractRenderState(GuiGraphicsExtractor g,int mx,int my,float delta) {
        super.extractRenderState(g,mx,my,delta);
        int top=Math.max(26,height/2-104);
        g.centeredText(font,Component.literal(ItemFilters.isWhitelistMode()?
          "Whitelist: macro ONLY works with selected items" :
          "Blacklist: macro pauses on selected items"),width/2,top-15,0xFFD977);
        for(int i=0;i<visibleItems.size();i++){
            ItemStack stack=new ItemStack(visibleItems.get(i));
            Button b=slots.get(i);
            g.item(stack,b.getX()+3,b.getY()+3);
            if(mx>=b.getX()&&mx<b.getX()+b.getWidth()&&my>=b.getY()&&my<b.getY()+b.getHeight()){
                g.setTooltipForNextFrame(font,stack,mx,my);
            }
        }
    }
    @Override public void onClose(){minecraft.gui.setScreen(parent);}
    @Override public boolean isPauseScreen(){return false;}
}
