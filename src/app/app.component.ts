import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title;
  windowOptions = {'showstartoverlay':false};
  constructor(){
  	this.title = 'SAR Client'
  	this.windowOptions = {'showstartoverlay':true}
  }
}
