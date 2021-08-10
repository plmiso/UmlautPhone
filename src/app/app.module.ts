import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { SipConnectionService } from './services/sip-connection.service';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule
  ],
  providers: [SipConnectionService],
  bootstrap: [AppComponent]
})
export class AppModule { }
