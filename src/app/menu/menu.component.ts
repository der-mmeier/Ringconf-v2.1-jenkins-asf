import {Component, Input, ViewEncapsulation, ChangeDetectionStrategy} from '@angular/core';
import {AppComponent} from "../app.component";
import {environment} from "../../environments/environment";

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

  navigation = navigation;
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
    this.changeHash(hash);
  }

  isMobileMoreActive()
  {
    return navigation.currentHash === 'more' || this.mobileMoreItems.some(item => item.hash === navigation.currentHash);
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
    url.hash = canonicalHashes[parsed] || "profile";
    window.history.replaceState(window.history.state, "", url);
  }

  requestWebglResize();
}

function parseNavigationHash(hash: string)
{
  let cleaned = decodeURIComponent((hash || "").replace(/^#/, "")).toLowerCase();
  if (cleaned === "") return "profil";
  return hashAliases[cleaned] || "profil";
}

function hashChanged()
{
  setNavigationHash(window.location.hash, false);
}

hashChanged();

function requestWebglResize()
{
  window.setTimeout(function () {
    const webgl = (window as any).__oneRingconfWebgl;
    if (webgl && typeof webgl.resizeViewport === "function") {
      webgl.resizeViewport();
    } else if (webgl && typeof webgl.resize === "function") {
      webgl.resize();
    }
  }, 0);

  window.setTimeout(function () {
    const webgl = (window as any).__oneRingconfWebgl;
    if (webgl && typeof webgl.resizeViewport === "function") {
      webgl.resizeViewport();
    } else if (webgl && typeof webgl.resize === "function") {
      webgl.resize();
    }
  }, 240);
}
