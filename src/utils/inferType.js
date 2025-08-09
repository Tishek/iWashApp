import { normalizeStr } from './text';
import { OVERRIDE_FULL, OVERRIDE_EXCLUDE } from './constants';

export function inferType(name = '', types = [], address = '') {
  const text = normalizeStr(`${name} ${(types || []).join(' ')} ${address}`).toLowerCase();
  const typesText = ((types || []).join(' ') || '').toLowerCase();

  const FULL_BRANDS = ['kk detail','kkdetail','solid car wash','solid carwash','mobilewash','wash&go','wash and go','automycka express','automyckaexpress'];
  const FULL_GENERIC = ['rucni myti','rucni cisteni','rucne','hand wash','handwash','manual wash','detailing','autodetail','cisteni interieru','myti interieru','tepovani','impregnace','voskovani','lesteni','valet','valeting','steam wash','parni myti','myti s obsluhou','mobilni myti','mobile wash'];

  const NONCONTACT_BRANDS = ['ehrle','elephant blue','elephant','bkf','sb wash','sb mycka','washbox','wash box','jetwash','jet wash'];
  const NONCONTACT_GENERIC = ['bezkontakt','bez kontakt','touchless','brushless','self service','self-service','samoobsluz','samoobsluzna','samoobsluzne','wap','vapka','pressure','box','boxy','wash point','washpoint'];

  const CONTACT_BRANDS = ['imo','washtec','christ'];
  const CONTACT_GENERIC = ['automat','automatic','tunnel','tunel','rollover','portal','portalova','brush','kartac','kartace','myci linka','myci tunel','shell','mol','omv','orlen','benzina','eurooil','ono','globus','tesco'];

  const count = arr => arr.reduce((a, term) => a + (text.includes(term) ? 1 : 0), 0);

  let scoreFull = count(FULL_BRANDS) * 2 + count(FULL_GENERIC);
  let scoreNon  = count(NONCONTACT_BRANDS) * 2 + count(NONCONTACT_GENERIC);
  let scoreCon  = count(CONTACT_BRANDS) * 2 + count(CONTACT_GENERIC);
  if (typesText.includes('gas_station')) scoreCon += 1;

  const max = Math.max(scoreFull, scoreNon, scoreCon);
  if (max < 1) return 'UNKNOWN';

  const n = normalizeStr(name).toLowerCase();
  const a = normalizeStr(address).toLowerCase();
  if (OVERRIDE_EXCLUDE.some(k => n.includes(k) || a.includes(k))) return 'UNKNOWN';
  if (OVERRIDE_FULL.some(k => n.includes(k) || a.includes(k))) return 'FULLSERVICE';

  if (scoreFull === max) return 'FULLSERVICE';
  if (scoreNon === max) return 'NONCONTACT';
  return 'CONTACT';
}