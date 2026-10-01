import { AutofocusDirective } from './autofocus';
import { ElementRef } from '@angular/core';

describe('AutofocusDirective', () => {
  it('should create an instance', () => {
    const directive = new AutofocusDirective(new ElementRef(document.createElement('input')));
    expect(directive).toBeTruthy();
  });
});
