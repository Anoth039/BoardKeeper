import { AutofocusDirective } from './autofocus';
import { ElementRef } from '@angular/core';

describe('Automatikus fókusz', () => {
  it('létrehozható', () => {
    const directive = new AutofocusDirective(new ElementRef(document.createElement('input')));
    expect(directive).toBeTruthy();
  });
});
