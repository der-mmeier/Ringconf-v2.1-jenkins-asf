import {Component, Input, ViewEncapsulation} from '@angular/core';
import {AppComponent} from "../app.component";
import {environment} from "../../environments/environment";

@Component({
  selector: 'x-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class MenuComponent
{
  app = AppComponent.app;
  env = environment;
  @Input() mode: string = "Desktop";

  navigation = navigation;
  mobileExpanded=false;

  changeHash(hash: string)
  {
    this.mobileExpanded = false;
    window.location.hash = hash;
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
  currentHash: window.location.hash,
};

window.addEventListener('hashchange', hashChanged);

function hashChanged()
{
  let index = navigation.items.findIndex(function (e)
  {
    return ('#'+e.hash) === window.location.hash
  });
  if (index == -1 && (window.location.hash !== '#admin' && window.location.hash !== '#diamond')) window.location.hash = navigation.items[0].hash;
  navigation.currentHash = window.location.hash.substring(1);
}

hashChanged();
