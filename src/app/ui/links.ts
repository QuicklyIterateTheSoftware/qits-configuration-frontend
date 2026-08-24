import { inject, Injectable } from '@angular/core';
import { QITS_SCOPE, scopeCommands, type QitsScope } from '@qits/ui-components';

/**
 * Every in-app address, relative to the scope on screen.
 *
 * <p>The same page is served at `/applications/qits-docs` and at
 * `/qits/services/qits-docs/applications/qits-docs`, so a `routerLink` starting at `/` would drop
 * out of the second one. The prefix comes from the URL; a template asks for
 * `commands('applications', name)` and never spells the leading slash itself.
 */
@Injectable({ providedIn: 'root' })
export class ConfigurationLinks {
  private readonly scopeSource = inject(QITS_SCOPE, { optional: true });

  /** What the address says is on screen. */
  scope(): QitsScope | undefined {
    return this.scopeSource?.scope();
  }

  /** Router commands for one of this app's own pages, inside whatever scope is on screen. */
  commands(...path: readonly string[]): string[] {
    return [...scopeCommands(this.scope()), ...path];
  }
}
