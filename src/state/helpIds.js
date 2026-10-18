/**
 * helpIds.js — inventaris bantuan ⓘ (Bagian C): setiap id yang diberi kartu bantuan, dan elemen yang sengaja tidak.
 * Dijaga tests/help.test.js: setiap id di HELP_IDS punya item di content/help.json DAN dipasang di sumber
 * (`help: '<id>'` / createHelpButton('<id>')); tidak ada item yatim. Id dipakai bersama antar-scene bila konsepnya sama
 * (kalimat bantuan generik, tanpa menyebut scene tertentu).
 */

export const HUD_HELP_IDS = Object.freeze([
  'hud.pmax', 'hud.thetaPmax', 'hud.imep', 'hud.etaIndicated', 'hud.etaBrake', 'hud.bsfc',
  'hud.etaIdeal', 'hud.sameR', 'hud.tmax', 'hud.gap', 'hud.bwr', 'hud.wnet', 'hud.compOutT', 'hud.exhaustT',
  'hud.flameT', 'hud.localDeltaT', 'hud.qin', 'hud.heatRelease',
  'hud.timing', 'hud.burnedT', 'hud.noxG', 'hud.noxPpm', 'hud.noxMg', 'hud.co2', 'hud.noxCalib',
  'hud.etaThermal', 'hud.heatRate', 'hud.power', 'hud.derating', 'hud.powerIso', 'hud.speed',
  'hud.turbineInletT', 'hud.coPpm', 'hud.igv', 'hud.loadWindow',
  'hud.pressureRatio', 'hud.head', 'hud.compPower', 'hud.dischargeT', 'hud.suctionFlow', 'hud.speedRequired', 'hud.ptAvailable', 'hud.turbineLoad', 'hud.nGG',
  'hud.co2Diesel', 'hud.co2e', 'hud.slip', 'hud.slipToCo2e', 'hud.gwp', 'hud.pm',
  'hud.limitStatus', 'hud.exhaustO2', 'hud.lambda', 'hud.sweepTime', 'hud.fuelPenalty', 'hud.slipShare', 'hud.limitNox', 'hud.limitCo',
]);

export const CTL_HELP_IDS = Object.freeze([
  'ctl.engine', 'ctl.cycleKind', 'ctl.cycleModel', 'ctl.turbineConfig', 'ctl.mixMode', 'ctl.strategy', 'ctl.limUnit',
  'ctl.compressionRatio', 'ctl.equivalence', 'ctl.timing', 'ctl.crankAngle', 'ctl.cutoffRatio', 'ctl.localPhi', 'ctl.intakeT', 'ctl.intakeModel',
  'ctl.pressureRatio', 'ctl.dualPressureRatio', 'ctl.turbineInletT', 'ctl.etaC', 'ctl.etaT', 'ctl.etaGG', 'ctl.etaPT', 'ctl.ambientT', 'ctl.load', 'ctl.aux',
  'ctl.suctionP', 'ctl.dischargeP', 'ctl.gasMW', 'ctl.massFlow', 'ctl.speedWhatIf',
  'ctl.slip', 'ctl.fuelPenalty',
  'ctl.leverAxis', 'ctl.leverSub', 'ctl.boost', 'ctl.engineSpeed', 'ctl.calibration', 'ctl.fuelComposition', 'ctl.h2s', 'ctl.sulfur',
  'ctl.play', 'ctl.freeze', 'ctl.reset', 'ctl.labels', 'ctl.replay', 'ctl.focus', 'ctl.bloom', 'ctl.animSpeed',
]);

export const UI_HELP_IDS = Object.freeze([
  'ui.s9tabs', 'ui.regSelectors', 'ui.siteData', 'ui.limitOverride', 'ui.presetBadge', 'ui.statusChip',
  'ui.tempLegend', 'ui.speciesLegend', 'ui.calibration', 'ui.basisCard', 'ui.assumptions',
  'nav.learn', 'nav.scenes', 'nav.pages', 'nav.tools', 'nav.keys',
  'hdr.switches', 'hdr.status',
]);

/** Semua id yang diberi bantuan. */
export const HELP_IDS = Object.freeze([...HUD_HELP_IDS, ...CTL_HELP_IDS, ...UI_HELP_IDS]);

/** Elemen yang sengaja tidak diberi bantuan, dengan alasan (disebut di laporan). */
export const HELP_SKIPPED = Object.freeze([
  { what: 'charts', why: 'ⓘ grafik Step 03 sudah membuka panduan dari learn.charts' },
  { what: 'formula chip', why: 'pojok kiri atas viewport dicadangkan untuk chip; labelnya jelas dan panel rumusnya adalah penjelasannya' },
  { what: 'nav items (each scene/page)', why: 'rail 52 px tidak muat; tiap item punya tooltip, kelompok punya ⓘ' },
  { what: 'collapsed nav rail', why: 'tidak muat; ⓘ kelompok tampil saat rail terbuka' },
  { what: 'Scene 10 cards and Scene 11', why: 'isinya sudah berupa penjelasan' },
  { what: 'reading pages (Regulations, References, Glossary, Formation, Landing, About, Learn, Chart guide)', why: 'halaman baca dengan teks pengantar sendiri' },
  { what: 'presenter window/panel, debug overlay, toasts', why: 'alat pembawa acara dan pengembang, bukan audiens' },
  { what: 'inputs inside Calibration panel and Assumptions page', why: 'dijelaskan satu ⓘ di judul panel' },
  { what: 'axis labels, ticks, captions', why: 'bagian dari grafik' },
]);
