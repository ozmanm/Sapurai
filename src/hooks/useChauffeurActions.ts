import { mid } from '../utils/id.js';
import type { Chauffeur } from '../types.js';

/**
 * Actions CRUD sur les chauffeurs. Extraite de useAppLogic dans le refactor E.
 */

export interface ChauffeurActionsDeps {
  db: any;
  sv: (data: any) => void;
  nf: (m: string, t?: string) => void;
  setMl: (ml: any) => void;
  chs: Chauffeur[];
}

export default function useChauffeurActions(p: ChauffeurActionsDeps) {
  var db = p.db, sv = p.sv, nf = p.nf, setMl = p.setMl, chs = p.chs;

  function addCh(d: any): void {
    sv(Object.assign({}, db, { chs: chs.concat([Object.assign({}, d, { id: mid(), pm: parseInt(d.pm) || 0 })]) }));
    nf("Chauffeur ajoute"); setMl(null);
  }

  function editCh(id: string, d: any): void {
    sv(Object.assign({}, db, { chs: chs.map(function (c) { return c.id === id ? Object.assign({}, c, d, { pm: parseInt(d.pm) || 0 }) : c; }) }));
    nf("Chauffeur modifie"); setMl(null);
  }

  function deleteCh(id: string): void {
    sv(Object.assign({}, db, { chs: chs.filter(function (x) { return x.id !== id; }) }));
    nf("Chauffeur supprime", "error");
  }

  return { addCh, editCh, deleteCh };
}
