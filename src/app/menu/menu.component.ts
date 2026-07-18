import {Component, Input, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {AppComponent} from "../app.component";
import {environment} from "../../environments/environment";
import {
  ConfiguratorLayoutMode,
  isConfiguratorDrawerMode,
  isConfiguratorRailMode
} from "../layout/configurator-layout.models";

@Component({
    selector: 'x-menu',
    templateUrl: './menu.component.html',
    styleUrls: ['./menu.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class MenuComponent
{
  app = AppComponent.app;
  env = environment;
  @Input() mode: string = "Desktop";
  @Input() layoutMode: ConfiguratorLayoutMode = "desktop-compact";

  navigation = navigation;
  adaptiveItems = navigation.items;
  mobileExpanded=false;
  mobilePrimaryItems = navigation.items.filter(item => ['profil', 'masse', 'material', 'steinbesatz'].indexOf(item.hash) !== -1)
    .map(item => item.hash === 'steinbesatz' ? {...item, title: 'Steine'} : item);
  mobileMoreItems = navigation.items.filter(item => ['fugen', 'gravur'].indexOf(item.hash) !== -1);

  changeHash(hash: string)
  {
    this.mobileExpanded = false;
    setNavigationHash(hash, true);
  }

  selectMobileItem(hash: string)
  {
    this.mobileExpanded = false;
    if (this.isMobileItemActive(hash)) {
      closeNavigationPanel();
      return;
    }
    setNavigationHash(hash, true);
  }

  selectAdaptiveItem(hash: string)
  {
    if (isConfiguratorDrawerMode(this.layoutMode) && navigation.currentHash === hash) {
      closeNavigationPanel();
      return;
    }
    this.changeHash(hash);
  }

  getAdaptiveTitle(title: string): string
  {
    if (this.layoutMode === "phone-landscape") {
      return title
        .replace("Fugen / Stufen", "Fugen")
        .replace("Steinbesatz", "Steine");
    }
    if (this.layoutMode === "tablet-landscape") {
      return title.replace("Fugen / Stufen", "Fugen");
    }
    return title;
  }

  isRailMode(): boolean
  {
    return isConfiguratorRailMode(this.layoutMode);
  }

  isMobileMoreActive()
  {
    return navigation.currentHash === 'more' || this.mobileMoreItems.some(item => item.hash === navigation.currentHash);
  }

  isMobileItemActive(hash: string)
  {
    return hash === 'more' ? this.isMobileMoreActive() : navigation.currentHash === hash;
  }

  requestResize()
  {
    requestWebglResize();
  }

  isFirstNavItem()
  {
    let index = navigation.items.findIndex(f =>
    {
      return f.hash == navigation.currentHash;
    });

    return index == 0;
  }

  isLastNavItem()
  {
    let index = navigation.items.findIndex(f =>
    {
      return f.hash == navigation.currentHash;
    });

    return index == navigation.items.length - 1;
  }

  prev()
  {
    let index = navigation.items.findIndex(f =>
    {
      return f.hash == navigation.currentHash;
    });

    if (index > 0)
    {
      index--;
      this.changeHash(navigation.items[index].hash);
    }
  }

  next()
  {
    let index = navigation.items.findIndex(f =>
    {
      return f.hash == navigation.currentHash;
    });

    if (index < navigation.items.length - 1)
    {
      index++;
      this.changeHash(navigation.items[index].hash);
    }
  }
}

export let navigation = {
  items: [
    {
      title: "Profil",
      hash: "profil",
      img: "icon-ringprofil.svg"
    },
    {
      title: "Masse",
      hash: "masse",
      img: "icon-ringmasse.svg"
    },
    {
      title: "Material",
      hash: "material",
      img: "icon-material.svg"
    },
    {
      title: "Fugen / Stufen",
      hash: "fugen",
      img: "icon-fugen-stufen.svg"
    },
    {
      title: "Steinbesatz",
      hash: "steinbesatz",
      img: "icon-steinbesatz.svg"
    },
    {
      title: "Gravur",
      hash: "gravur",
      img: "icon-gravur.svg"
    },
  ],
  currentHash: "profil",
};

window.addEventListener('hashchange', hashChanged);

let activeLayoutMode: ConfiguratorLayoutMode = "desktop-compact";

const hashAliases: {[key: string]: string} = {
  profile: "profil",
  profil: "profil",
  dimension: "masse",
  masse: "masse",
  "ma\u00dfe": "masse",
  material: "material",
  stone: "steinbesatz",
  steine: "steinbesatz",
  steinbesatz: "steinbesatz",
  more: "more",
  mehr: "more",
  fugen: "fugen",
  gravur: "gravur",
  admin: "admin",
  diamond: "diamond"
};

const canonicalHashes: {[key: string]: string} = {
  profil: "profile",
  masse: "dimension",
  material: "material",
  steinbesatz: "stone",
  more: "more",
  fugen: "fugen",
  gravur: "gravur",
  admin: "admin",
  diamond: "diamond"
};

export function setNavigationHash(hash: string, updateUrl: boolean = false)
{
  let parsed = parseNavigationHash(hash);
  navigation.currentHash = parsed;

  if (updateUrl)
  {
    let url = new URL(window.location.href);
    if (parsed) {
      url.hash = canonicalHashes[parsed] || "profile";
    } else {
      url.hash = "";
    }
    window.history.replaceState(window.history.state, "", url);
  }

  updateMobilePanelState();
  requestWebglResize();
}

export function closeNavigationPanel()
{
  navigation.currentHash = isCompactNavigationMode() ? "" : "profil";
  let url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(window.history.state, "", url);
  updateMobilePanelState();
  requestWebglResize();
}

function parseNavigationHash(hash: string)
{
  let cleaned = "";
  try {
    cleaned = decodeURIComponent((hash || "").replace(/^#/, "")).toLowerCase();
  } catch {
    cleaned = "";
  }
  if (cleaned === "") return isCompactNavigationMode() ? "" : "profil";
  return hashAliases[cleaned] || (isCompactNavigationMode() ? "" : "profil");
}

function hashChanged()
{
  setNavigationHash(window.location.hash, false);
}

hashChanged();

export function setNavigationLayoutMode(mode: ConfiguratorLayoutMode)
{
  activeLayoutMode = mode;
  updateMobilePanelState();
}

function requestWebglResize()
{
  let resize = function () {
    const webgl = (window as any).__oneRingconfWebgl;
    if (webgl && typeof webgl.resizeAndRender === "function") {
      webgl.resizeAndRender();
    } else if (webgl && typeof webgl.resizeViewport === "function") {
      webgl.resizeViewport();
    } else if (webgl && typeof webgl.resize === "function") {
      webgl.resize();
    }
  };

  window.requestAnimationFrame(resize);
}

function isCompactNavigationMode()
{
  return activeLayoutMode === "phone-portrait"
    || activeLayoutMode === "phone-landscape"
    || activeLayoutMode === "tablet-portrait";
}

function updateMobilePanelState()
{
  let compact = isCompactNavigationMode();
  let panelOpen = compact && navigation.currentHash !== "";
  document.body.classList.toggle("mobile-panel-open", panelOpen);
  document.body.classList.toggle("mobile-panel-closed", compact && !panelOpen);
}
