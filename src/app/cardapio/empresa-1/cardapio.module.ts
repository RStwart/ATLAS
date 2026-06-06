import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardapioComponent } from './cardapio.component';
import { CardapioRoutingModule } from './cardapio-routing.module';

@NgModule({
  declarations: [CardapioComponent],
  imports: [
    CommonModule,
    FormsModule,
    CardapioRoutingModule
  ]
})
export class CardapioModule { }
