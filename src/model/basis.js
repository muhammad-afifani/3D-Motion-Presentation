/**
 * basis.js — registry of the theory behind every export of thermo.js.
 *
 * One entry per export: { level, refs, derivation, assumptions, toVerify? }.
 *   level        'Ideal' | 'Real' | 'Semi-empirical' | 'Site data'  (the model-level word shown in the Basis tag)
 *   refs         ids from content/references.json ONLY (tests/basis.test.js). A source that is not in that file is
 *                never invented: it goes in `toVerify` and the UI shows it as "source to verify".
 *   derivation   one or two sentences: which concept the formula comes from
 *   assumptions  what the model leaves out or fixes (honest limits; shown in the Basis card and the H panel)
 *   toVerify     optional list of sources/values that still need a reference
 * Exports of thermo.js that are plain math or drawing helpers are listed in UTILITY instead.
 * Changing a formula in thermo.js means updating its entry here (tests/basis.test.js enforces coverage).
 *
 * The reference ids give a place to look; chapter and equation numbers are only as good as the
 * `locatorVerified` flag in references.json (all false until the project owner checks a physical copy).
 */

export const LEVELS = Object.freeze(['Ideal', 'Real', 'Semi-empirical', 'Site data']);

/** Helper exports (math, root finding, drawing, animation timing): no thermodynamic basis needed. */
export const UTILITY = Object.freeze({
  clamp: 'Limit a number to a range.',
  lerp: 'Linear interpolation.',
  deg2rad: 'Degrees to radians.',
  lookup1D: 'Linear interpolation through a table of points (used to inject OEM/CEMS curves).',
  bisect: 'Bisection root finder (used by calibration and load matching).',
  logNorm: 'Log scale to 0–1 for particle rates (drawing only).',
  tempToRGB: 'Temperature to colour for the 3D scenes (drawing only; every use shows a K legend).',
  flameColor: 'Equivalence ratio to flame colour (drawing only).',
  valveLift: 'Half-sine valve lift for the animation (kinematic drawing aid, not a flow model).',
  crankAngleAt: 'Crank angle at time t for the animation clock.',
  pvLoop: 'Closes the P-V loop of a simulation for plotting.',
  selfTest: 'Golden-value self-test behind the "Model OK" badge.',
});

const e = (level, refs, derivation, assumptions = [], toVerify = []) => Object.freeze({ level, refs: Object.freeze(refs), derivation, assumptions: Object.freeze(assumptions), toVerify: Object.freeze(toVerify) });

const AIR = ['Ideal gas with constant specific heats (k = 1.4) except where cv(T) is stated.'];
const EMISSION_INDICATIVE = 'Indicative correlation: the trend is physical, the absolute level is calibrated to typical literature values, not to site data.';

export const BASIS = Object.freeze({
  // ───────────────────────────── constants and fuel data ─────────────────────────────
  R_AIR: e('Ideal', ['cengel-boles'], 'Specific gas constant of air, R = R_u / M with M ≈ 29 kg/kmol.', ['Dry air; humidity ignored.']),
  K_AIR: e('Ideal', ['cengel-boles'], 'Cold-air-standard heat-capacity ratio of air at room temperature.', ['Constant; real k falls with temperature (see cvOfT).']),
  CV_AIR: e('Ideal', ['cengel-boles'], 'cv = R / (k − 1) for an ideal gas.', AIR),
  CP_AIR: e('Ideal', ['cengel-boles'], 'cp = k·cv for an ideal gas.', AIR),
  CP_GAS: e('Real', ['saravanamuttoo', 'boyce'], 'One mean specific heat for hot combustion gas on the turbine side.', ['A single constant for the whole hot path; the variation with temperature and fuel/air ratio is not modeled.']),
  K_GAS: e('Real', ['saravanamuttoo', 'boyce'], 'One mean heat-capacity ratio for hot combustion gas on the turbine side (k ≈ 1.333).', ['Constant for the whole hot path.']),
  R_UNIV: e('Ideal', ['nist-webbook'], 'Universal gas constant.', []),
  GWP_CH4: e('Real', ['ipcc-ar6-wg1-ch7'], '100-year global warming potential of fossil methane (Table 7.15).', ['100-year horizon only; a 20-year view gives a much larger weight to methane.']),
  MW: e('Ideal', ['nist-webbook'], 'Molar masses of the species used in mass and ppm conversions.', []),
  FUELS: e('Real', ['iso-6976', 'nist-webbook', 'ipcc-2006-vol2-ch2'], 'Per-fuel LHV, stoichiometric air/fuel ratio and CO₂ emission factor for an idealised fuel (natural gas ≈ CH₄, diesel ≈ C₁₂H₂₃).',
    ['Fixed composition; real fuel gas varies, so LHV and the emission factor shift by a few percent.', 'The adiabatic-temperature offset for diesel (dTad) is a rough correction to the methane table.', 'CO₂ emission factors 56.1 and 74.1 g/MJ (LHV) are IPCC 2006 default values.']),

  // ───────────────────────────── numerical helpers with physics content ─────────────────────────────
  calibrateTo: e('Site data', [], 'Scale factor c so that a model output reaches a target value (c = target / model(1)).',
    ['Assumes the output is roughly linear in c (NOx saturates, so the calibration functions iterate).', 'Only as good as the target: the default targets are typical literature values, not data from your unit.']),
  cvOfT: e('Semi-empirical', ['cengel-boles', 'nist-janaf'], 'Linear fit of the specific heat of air with temperature, cv(T) = cv0 + 0.115·(T − 300).',
    ['Straight-line fit over 300–2500 K; it may deviate from tabulated air properties by a few percent in the middle of the range.'], ['Compare the fit against a printed property table before quoting accuracy.']),
  kOfT: e('Semi-empirical', ['cengel-boles'], 'k = 1 + R / cv(T) for an ideal gas with temperature-dependent cv.', ['Follows cvOfT, so it inherits its fit error.']),
  processPath: e('Ideal', ['cengel-boles'], 'Ideal-gas state paths: isentropic (P·vᵏ constant), isochoric, isobaric and polytropic.', AIR),

  // ───────────────────────────── ideal cycles ─────────────────────────────
  otto: e('Ideal', ['cengel-boles', 'heywood'], 'Air-standard Otto cycle: isentropic compression and expansion, heat added at constant volume; η = 1 − r^(1−k).', AIR),
  diesel: e('Ideal', ['cengel-boles', 'heywood'], 'Air-standard Diesel cycle: heat added at constant pressure; η = 1 − r^(1−k)·(rcᵏ − 1) / (k·(rc − 1)).', AIR),
  dual: e('Ideal', ['cengel-boles', 'heywood'], 'Air-standard dual cycle: part of the heat at constant volume, part at constant pressure.', AIR),
  braytonIdeal: e('Ideal', ['cengel-boles', 'saravanamuttoo'], 'Air-standard Brayton cycle: isentropic compression and expansion, constant-pressure heat addition; η = 1 − rp^(−(k−1)/k).', AIR),

  // ───────────────────────────── real gas-turbine cycles ─────────────────────────────
  braytonReal: e('Real', ['saravanamuttoo', 'boyce'], 'Brayton cycle with compressor and turbine isentropic efficiencies, combustor pressure loss and mechanical loss.',
    ['Constant cp and k on the air side and on the hot-gas side.', 'Fuel mass flow is not added to the turbine flow; no cooling-air bleed, no inlet/exhaust losses.', 'Heat added is cpg·(T3 − T2), a mixed-property simplification.']),
  pressureAtAltitude: e('Ideal', ['iso-2533'], 'International-standard-atmosphere pressure at altitude h in the troposphere.', ['Standard atmosphere; no weather variation.']),
  braytonDerated: e('Real', ['saravanamuttoo', 'boyce'], 'Re-runs braytonReal at the site ambient temperature and pressure; mass flow scales with air density (∝ P/T).',
    ['Mass flow ∝ P/T: constant volumetric flow at constant shaft speed, so mass flow follows air density. A P/√T scaling applies instead at constant corrected speed (N/√T), which this model does not use.', 'Turbine inlet temperature T3 is held constant (no control limit).']),
  singleShaftLoad: e('Real', ['saravanamuttoo'], 'Part-load of a single-shaft machine at constant speed: first close the IGV to cut air flow with T3 held, then lower T3 once the IGV reaches its minimum.',
    ['Fixed IGV minimum; compressor and turbine efficiencies are held constant off-design (no component map).']),
  twinShaft: e('Real', ['saravanamuttoo', 'boyce'], 'Gas generator plus free power turbine: the gas-generator turbine only drives the compressor, the rest expands in the power turbine.',
    ['Mass flow ∝ Ngg and pressure rise ∝ Ngg² are simple scaling laws, not a compressor map.', 'Constant component efficiencies and constant cp, k.']),
  twinShaftForLoad: e('Real', ['saravanamuttoo'], 'Finds the gas-generator speed and T3 that deliver a given fraction of design power, with a linear T3 schedule vs Ngg.',
    ['The T3 schedule (default 0.75 + 0.25·Ngg) is an assumption, not an OEM schedule.']),
  compressorStages: e('Real', ['saravanamuttoo'], 'Per-stage temperature of the axial compressor for the 3D colouring: equal pressure-ratio steps through the same T2 formula as the cycle.',
    ['Equal stage pressure ratios and equal stage efficiency; drawing aid whose last stage equals the cycle T2.']),
  turbineStages: e('Real', ['saravanamuttoo'], 'Per-stage temperature of the turbine for the 3D colouring: equal expansion-ratio steps through the cycle expansion formula.',
    ['Equal stage expansion ratios; drawing aid whose last stage equals the cycle outlet temperature.']),
  twinShaftCycle: e('Real', ['saravanamuttoo', 'boyce'], 'Twin-shaft cycle states 1, 2, 3, 4.5, 5 with ambient derating (air density ∝ P/T at fixed Ngg).',
    ['Same limits as twinShaft.', 'Mass flow ∝ P/T: constant volumetric flow at constant gas-generator speed (fixed Ngg), so mass flow follows air density. A P/√T scaling applies instead at constant corrected speed (N/√T), which this model does not use.']),

  // ───────────────────────────── gas compressor ─────────────────────────────
  gasCompressor: e('Real', ['dixon-hall', 'api-617'], 'Polytropic head H = (Z·R·T1 / m)·(rp^m − 1) with m = (k − 1) / (k·ηp); shaft power = ṁ·H / ηp.',
    ['Constant Z, k and polytropic efficiency along the compression.', 'Single section; no compressor map, surge or stonewall.']),
  affinity: e('Ideal', ['dixon-hall'], 'Affinity laws at constant efficiency: Q ∝ N, H ∝ N², P ∝ N³.', ['Valid only near the design point; ignores the change of efficiency with flow and speed.']),
  speedForHead: e('Ideal', ['dixon-hall'], 'Speed that gives a required head from the head–speed law H ∝ N².', ['Looks at head alone: flow matching and surge limits are not checked.']),
  suctionFlow: e('Real', ['api-617'], 'Actual volumetric flow at suction from the real-gas law, Q = ṁ·Z·R·T / (P·M).', ['Constant compressibility Z.']),
  compressorTrain: e('Real', ['saravanamuttoo', 'api-617'], 'Couples the gas compressor power to the twin-shaft turbine load (Scene 7 to 5/6) and then to the DLN emission model.',
    ['Turbine load is power ratio only; compressor map, surge, speed limits and driver–driven matching are not modeled.', EMISSION_INDICATIVE]),

  // ───────────────────────────── piston engine ─────────────────────────────
  engineGeometry: e('Ideal', ['heywood'], 'Crank-slider kinematics: piston position and cylinder volume V(θ) from bore, stroke, rod length and compression ratio.', ['Rigid parts; no crevice volume.']),
  wiebe: e('Semi-empirical', ['ghojel-2010', 'heywood'], 'Wiebe function: burned mass fraction x = 1 − exp(−a·((θ − θ0)/Δθ)^(m+1)) with a = 6.908 (99.9 % burned).',
    ['Burn start, duration and shape factor are inputs, not predicted from fuel injection or flame speed.']),
  chenFlynnFMEP: e('Semi-empirical', ['chen-flynn-1965', 'heywood'], 'Friction mean effective pressure from a fit in peak cylinder pressure and mean piston speed.',
    ['Empirical fit made for specific engine families; indicative for other engines.']),
  ENGINE_NOX_CALIB: e('Site data', [], 'Engine NOx calibration factor (0.17): scales the Zeldovich rate so that the presets land near typical literature NOx levels.',
    ['Calibrated to typical literature values, not site data.', 'A factor other than the default is shown on the HUD.']),
  ENGINE_PRESETS: e('Semi-empirical', ['heywood'], 'Typical large-bore diesel and lean-burn gas engine parameter sets (geometry, boost, burn timing).',
    ['Illustrative values, not any specific engine; replace with unit data for site work.']),
  cylinderSim: e('Semi-empirical', ['heywood', 'ghojel-2010'], 'Closed-cycle first-law model from IVC to EVO: dP/dθ = −k(T)·(P/V)·dV/dθ + (k − 1)/V·dQ/dθ with Wiebe heat release, integrated with RK4.',
    ['Single zone for pressure and temperature; no pumping work, no work after EVO.', 'Wall heat loss is a fixed fraction of the heat release (lossFrac).', 'Friction by the Chen–Flynn fit.', 'Uses the cv(T) fit (cvOfT).']),
  simStates: e('Semi-empirical', ['heywood'], 'Specific volume and entropy along a cylinderSim result for the T-s diagram: s − s(IVC) = ∫cv(T)/T dT + R·ln(v/v_ivc).', ['Uses the cv(T) fit; the entropy reference is the IVC state.']),
  sampleSim: e('Semi-empirical', ['heywood'], 'Interpolates the cylinderSim result for the animation; outside the closed phase (intake, exhaust) it uses simple decay laws.',
    ['Intake and exhaust strokes are schematic: constant intake state, exponential blow-down to exhaust pressure.']),
  lossWaterfall: e('Semi-empirical', ['heywood', 'cengel-boles'], 'Steps from the ideal efficiency limit to brake efficiency by switching on one real effect at a time: variable specific heat, finite burn time, heat loss and unburned fuel, friction.',
    ['The first bar is the Otto limit (1 − r^(1−k)) for both engine kinds, so for the diesel preset it is an upper bound.', 'The size of each step depends on the order in which the effects are added.']),

  // ───────────────────────────── flame, NOx, CO ─────────────────────────────
  flameTemperature: e('Semi-empirical', ['turns', 'nist-janaf'], 'Adiabatic flame temperature vs equivalence ratio from a methane table, corrected for fuel and for inlet temperature.',
    ['Table values of CH₄/air, about ±100 K; diesel by an offset; preheat gain reduced near stoichiometric to mimic dissociation.', EMISSION_INDICATIVE]),
  phiFromFlameT: e('Semi-empirical', ['turns'], 'Inverse of flameTemperature on the lean side (bisection).', ['Lean side only (φ 0.25–1).']),
  burnedComposition: e('Ideal', ['turns'], 'Complete-combustion product composition of CxHy with excess air: CO₂, H₂O, N₂ and leftover O₂.', ['No dissociation, no CO or NOx in the balance; rich mixtures are treated as stoichiometric.']),
  ZELDOVICH: e('Semi-empirical', ['heywood', 'zeldovich-1946', 'lavoie-1970'], 'Constants of the simplified thermal-NO rate d[NO]/dt = 6×10¹⁶/√T·exp(−69,090/T)·[O₂]^½·[N₂] (A = 6e16, Ea = 69,090 K).',
    ['Equilibrium O-atom assumption; prompt NO, N₂O route and fuel-bound nitrogen are not included.', EMISSION_INDICATIVE]),
  noxThermal: e('Semi-empirical', ['heywood', 'lavoie-1970'], 'Thermal NO in a burned zone of fixed temperature over a residence time, with approach to equilibrium: x = xeq·tanh(k0·t / xeq).',
    ['Uniform zone at one temperature and composition.', 'Residence time is an input.', EMISSION_INDICATIVE]),
  zeldovichRate: e('Semi-empirical', ['heywood', 'zeldovich-1946'], 'Initial thermal-NO formation rate from the simplified Zeldovich expression.', ['No equilibrium limit in this rate; shows the Arrhenius sensitivity only.', EMISSION_INDICATIVE]),
  noxRateRatio: e('Semi-empirical', ['heywood'], 'Ratio of the Zeldovich rate at T + ΔT to the rate at T (the "+100 K ≈ ×N" statement).', ['Depends on temperature only; pressure and composition cancel.']),
  zeldovichCurve: e('Semi-empirical', ['heywood'], 'Relative Zeldovich rate against temperature (Arrhenius plot of Scene 4), normalised to a reference temperature.', [EMISSION_INDICATIVE]),
  coDLN: e('Semi-empirical', ['lefebvre', 'correa-1992'], 'Lean-premix CO window: a sigmoid in flame temperature, high at low flame temperature and flat at a baseline above it.',
    ['Illustrative shape; the real CO curve of a combustor comes from OEM or CEMS data (inject it with lookup1D).', 'Calibrated to typical literature values, not site data.']),
  dlnEmissions: e('Semi-empirical', ['lefebvre', 'correa-1992'], 'NOx and CO of a lean-premix (DLN) combustor at one operating point from the premix flame temperature.',
    ['Fixed premix fuel split; the OEM fuel-staging schedule is not modeled.', 'NOx level set by a calibration factor.', EMISSION_INDICATIVE]),
  dlnFromResult: e('Semi-empirical', ['lefebvre'], 'DLN emissions of a cycle result relative to the design point: premix equivalence ratio scales with heat added.', ['Fixed premix fuel split.', EMISSION_INDICATIVE]),
  loadSweep: e('Semi-empirical', ['saravanamuttoo', 'lefebvre'], 'Part-load sweep: cycle (IGV/fuel-only single-shaft, or twin-shaft) coupled to the DLN emission model at each load.',
    ['Single-shaft shows a CO cliff once the IGV runs out; twin-shaft shows a window that shifts and narrows. The size of both effects needs OEM/CEMS data.', 'Fixed premix fuel split.', EMISSION_INDICATIVE]),
  calibrateDLN: e('Site data', [], 'DLN NOx calibration: factor that makes the design point give a target NOx (default 15 ppm @ 15 % O₂).',
    ['Calibrated to typical literature values, not site data.', 'One factor per configuration (single-shaft, twin-shaft).']),
  calibrateEngineNOx: e('Site data', [], 'Engine NOx calibration: iterates the factor until the preset gives a target g/kWh.', ['Calibrated to typical literature values, not site data.']),
  noxCoTradeoff: e('Semi-empirical', ['lefebvre', 'correa-1992'], 'Sweep of flame temperature giving NOx and CO together (the trade-off window).', [EMISSION_INDICATIVE]),

  // ───────────────────────────── concentration, basis, mass emission ─────────────────────────────
  toDryRef: e('Ideal', ['epa-method-19', 'epa-method-3a'], 'Wet mole fraction to dry ppm at a reference O₂: divide by (1 − xH₂O), then multiply by (20.9 − O₂ref)/(20.9 − O₂dry).',
    ['Uses 20.9 % for O₂ in air; some regulations write 21 %. The difference is small but should match the rule you cite.'], ['Check the O₂ constant (20.9 vs 21) against the regulation annex.']),
  correctToRefO2: e('Ideal', ['epa-method-19', 'epa-method-3a', 'iso-11042'], 'Reference-O₂ correction C·(20.9 − O₂ref)/(20.9 − O₂meas) on a dry basis.',
    ['Uses 20.9 % for O₂ in air; some regulations write 21 %.'], ['Check the O₂ constant (20.9 vs 21) against the regulation annex.']),
  molarVolume: e('Ideal', ['nist-webbook'], 'Molar volume of an ideal gas at 1 atm: 22.414 m³/kmol at 0 °C, scaled linearly with temperature.', ['Ideal gas at 1 atm.']),
  ppmToMgNm3: e('Ideal', ['epa-method-19'], 'ppm to mg/Nm³ with the species molar mass and the molar volume at the chosen volume basis.', ['Dry basis; the volume basis (0 °C or 25 °C) must match the limit being compared.']),
  mgNm3ToPpm: e('Ideal', ['epa-method-19'], 'Inverse of ppmToMgNm3.', ['Dry basis; the volume basis must match.']),
  dryFlueNm3PerKg: e('Ideal', ['epa-method-19', 'turns'], 'Stoichiometric dry flue-gas volume per kg fuel (F-factor) from the combustion balance.', ['Dry air, fuel without N, S or ash.']),
  ppmToGkWh: e('Real', ['epa-method-19'], 'Concentration at reference O₂ to g per kWh shaft output using the dry flue-gas volume per kWh.',
    ['F-factor from the stoichiometric balance; efficiency is shaft (brake) based.', 'Cross-checked against the engine model within 1 %.']),
  emissionAtBasis: e('Ideal', ['epa-method-19', 'iso-11042'], 'Converts a ppm value to the display basis: reference O₂ first, then mg/Nm³ at the chosen volume basis.', ['Dry basis; basis values are inputs from the presenter.']),
  massRateKgH: e('Ideal', [], 'Mass emission rate = concentration × volumetric flow.', ['Flow and concentration on the same basis.']),
  exhaustFlowNm3h: e('Real', [], 'Flue-gas flow in Nm³/h from air plus fuel mass flow at a fixed density of 1.30 kg/Nm³.', ['Fixed density; water vapour not separated.'], ['Source of the 1.30 kg/Nm³ density: not in the reference list.']),

  // ───────────────────────────── CO₂, GHG, policy ─────────────────────────────
  qinPerKgAir: e('Ideal', ['turns'], 'Heat released per kg of air: q = φ·LHV·ηcomb / AFRst.', ['Complete energy balance; fixed AFRst and LHV.']),
  phiFromQinPerKgAir: e('Ideal', ['turns'], 'Inverse of qinPerKgAir: equivalence ratio for a given heat per kg air.', []),
  co2Specific: e('Real', ['ipcc-2006-vol2-ch2'], 'Specific CO₂ = emission factor × 3.6 / η (g/kWh).', ['Emission factor per MJ of fuel (LHV); complete oxidation of carbon.']),
  co2MassRate: e('Real', ['ipcc-2006-vol2-ch2'], 'CO₂ mass flow from the fuel mass flow, LHV and emission factor.', ['Same factors as co2Specific.']),
  fuelPerKWh: e('Ideal', [], 'Fuel mass per kWh = 3600 / (η·LHV).', []),
  co2eWithSlip: e('Real', ['ipcc-ar6-wg1-ch7'], 'CO₂e = CO₂ + GWP·CH₄ slip, with slip as a fraction of the fuel gas.', ['100-year GWP of fossil methane (29.8).', 'Slip fraction is an input, not a prediction.']),
  ghgPenalty: e('Real', [], 'Efficiency and CO₂ change when a NOx measure costs extra fuel: η₂ = η / (1 + penalty).', ['Penalty is an input; the fuel effect is applied directly to efficiency.']),
  retardSweep: e('Semi-empirical', ['heywood', 'lavoie-1970'], 'Sweep of injection/ignition timing through cylinderSim: later burning lowers peak temperature and NOx and costs efficiency.',
    ['Single-zone engine model; the NOx–efficiency trade is trend-level.', EMISSION_INDICATIVE]),
});

/**
 * Which entries a chart or HUD tag opens. A tag names a group; the Basis card lists the group's entries.
 * (Pure bookkeeping: the groups say which functions feed a chart, they hold no numbers.)
 */
export const BASIS_GROUPS = Object.freeze({
  engineCycle: ['engineGeometry', 'wiebe', 'cylinderSim', 'chenFlynnFMEP', 'cvOfT', 'kOfT', 'simStates', 'sampleSim'],
  idealCycles: ['processPath', 'otto', 'diesel', 'dual', 'braytonIdeal'],
  realCycles: ['processPath', 'braytonReal', 'braytonDerated', 'twinShaft', 'twinShaftCycle', 'compressorStages', 'turbineStages'],
  lossWaterfall: ['lossWaterfall', 'cylinderSim', 'cvOfT', 'wiebe', 'chenFlynnFMEP'],
  flame: ['flameTemperature', 'phiFromFlameT', 'burnedComposition', 'qinPerKgAir', 'cylinderSim'],
  noxCo: ['noxCoTradeoff', 'dlnEmissions', 'noxThermal', 'flameTemperature', 'coDLN', 'calibrateDLN'],
  zeldovich: ['ZELDOVICH', 'zeldovichRate', 'zeldovichCurve', 'noxRateRatio'],
  engineNox: ['cylinderSim', 'noxThermal', 'ZELDOVICH', 'ENGINE_NOX_CALIB', 'calibrateEngineNOx', 'toDryRef', 'ppmToMgNm3'],
  partLoad: ['loadSweep', 'singleShaftLoad', 'twinShaftForLoad', 'dlnFromResult', 'dlnEmissions', 'coDLN', 'calibrateDLN'],
  compressor: ['gasCompressor', 'suctionFlow', 'affinity', 'speedForHead', 'compressorTrain'],
  emissions: ['ppmToGkWh', 'emissionAtBasis', 'dryFlueNm3PerKg', 'co2Specific', 'co2eWithSlip', 'GWP_CH4', 'cylinderSim', 'dlnEmissions'],
  policy: ['retardSweep', 'ghgPenalty', 'co2eWithSlip', 'emissionAtBasis', 'loadSweep'],
});

/** Entry of an export (undefined when the name is a UTILITY helper or unknown). */
export const basisFor = (name) => BASIS[name];
/** Sources of an entry still missing from references.json, as the UI shows them: "source to verify". */
export const needsVerification = (name) => (BASIS[name]?.toVerify.length ?? 0) > 0;
