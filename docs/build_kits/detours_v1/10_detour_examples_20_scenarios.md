# Detour Examples: 20 Scenarios

**These scenarios are normative examples; implementation must satisfy them.**

---

## Scenarios 1–15 (Core Failure Playbook)

1. **PV Final Fails on Rapid-Shutdown Label Map Mismatch**
   **Trade / Context:** Solar PV, final inspection day. Array + inverter installed; electrical service upgrade already signed off; homeowner scheduled utility PTO paperwork. (Downstream work already started: closeout + PTO submission.)
   **Trigger:** Inspector flags missing/incorrect PV system labels / rapid shutdown placard not matching as-built equipment locations—common solar fail point. ([nvcogct.gov][1])
   **System behavior:**

* Create **DETOUR (non-blocking)** at CHECKPOINT="Final Inspection" to collect correct label set + updated one-line photo evidence.
* Mark "Final Inspection PASS" task outcome **PROVISIONAL** (validity overlay), reopen "Upload Label Photos" as **actionable** if prior evidence becomes **INVALID**.
* Allow downstream admin tasks (invoice draft, PTO packet prep) to continue, but **block Flow COMPLETED** while detour is ACTIVE.
* On detour resolution: set validity to **VALID**, **stable resume** to "PTO Submission" (resume target).
  **Field user sees:** "📎 Correction: Replace/verify PV labels + upload 6 photos. You can keep working; job can't close until done."
  **Admin sees:** DetourRecord tagged CLOSEOUT_ONLY, ACTIVE; completion guard banner: "1 active correction prevents completion." Can't force-complete.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=FinalInspection + RESUME_TARGET=PTO_Submission + VALIDITY={FinalInspection:PROVISIONAL}
  **Break risk:** Crew uploads *old* label photos; system marks detour resolved but inspector still fails next visit.
  **Guardrail:** Evidence upload requires **timestamped photo set** + "match component list" checklist before allowing "Resolve detour."
  **Angle of the angle:** AHJ requests label wording/font durability proof; homeowner gate is locked, access window shrinks (scheduling constraint).

---

2. **Service Upgrade Rough-In Fails Bonding of Metal Water Pipe**
   **Trade / Context:** Electrical (service upgrade), rough inspection before drywall. HVAC rough already started; framing crew waiting on sign-off. (Downstream started: HVAC rough + framing close-in planning.)
   **Trigger:** Inspector cites grounding/bonding deficiencies—common electrical inspection failure. ([Shaffer Construction][2])
   **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="Electrical Rough" to add missing bond jumper + clamp, upload photo + continuity test note.
* Keep HVAC rough tasks actionable (parallel branch), but block any node that is direct successor requiring "Electrical Rough VALID" (e.g., "Drywall Release").
* If field note indicates bonding touches gas line / main water entry with safety risk → **escalate detour to BLOCKING** mid-way.
* On resolution: set Electrical Rough outcome validity to **VALID**, stable resume to "Drywall Release."
  **Field user sees:** Initially "⚠️ Minor correction—bond water pipe; upload photo." After escalation: "🛑 Work paused on drywall release until corrected."
  **Admin sees:** Detour escalated NON_BLOCKING→BLOCKING, with audit trail of who escalated and why.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=ElecRough + RESUME_TARGET=DrywallRelease + VALIDITY={ElecRough:PROVISIONAL}
  **Break risk:** "Localized provisional" allows a downstream team to schedule drywall anyway.
  **Guardrail:** "Drywall Release" completion requires predecessor validity=VALID; UI refuses to mark release complete while detour ACTIVE/BLOCKING.
  **Angle of the angle:** Homeowner changes access hours; electrician must coordinate with plumber because bonding point is behind newly placed plumbing.

---

3. **HVAC Start-Up Fails: Condensate Drain Sags and Backs Up (Odor/Mold Risk)**
   **Trade / Context:** HVAC, start-up/commissioning after drywall and paint. Owner already moved furniture in; closeout cleaning scheduled. (Downstream started: finishes + customer occupancy.)
   **Trigger:** Start-up reveals condensate not draining due to poor slope/support; sagging lines cause standing water and clogs—common issue. ([Home Inspector][3])
   **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="HVAC Start-Up" to re-support line, correct slope, flush drain, upload video of steady flow.
* Mark start-up result **PROVISIONAL**.
* If smell persists after "fix" → symptom not cause: reopen detour task "Inspect pan/coil for bio-growth" and may trigger **Remediation Loop** for deeper root cause process (re-run "HVAC QA").
* If moisture is causing interior damage risk → detour escalates to **BLOCKING** (halts "Final Walkthrough").
  **Field user sees:** "⏳ Pending verification: condensate fix. Upload 30-sec drain test video." If repeat: "🔁 Repeat correction: inspect pan/coil—prior fix insufficient."
  **Admin sees:** Repeat detour count on same checkpoint; flags "possible root cause not addressed."
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=HVAC_StartUp + RESUME_TARGET=FinalWalkthrough + VALIDITY={HVAC_StartUp:PROVISIONAL}
  **Break risk:** Team marks HVAC start-up "done" without proof; customer complains later → trust loss.
  **Guardrail:** Detour cannot resolve without required evidence type (video + photo of trap/support points).
  **Angle of the angle:** Customer won't allow attic access except weekends; crew swap occurs mid-week.

---

4. **Plumbing Final Fails: Active Leak at Compression Stop Valve**
   **Trade / Context:** Plumbing, final inspection; cabinetry/vanities installed; painter touchups already started. (Downstream started: finishes.)
   **Trigger:** Inspector (or pre-walk) finds leak—leaks are common automatic failures and create damage risk. ([Paschal Air, Plumbing & Electric][4])
   **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="Plumbing Final" for leak fix + 15-minute pressure observation + photo evidence.
* If leak has already damaged drywall/cabinet toe-kick → detour escalates to **BLOCKING** because now multiple trades must coordinate (repair before sign-off).
* Symptom-not-cause pattern: tightening stop valve "fixes" temporarily; leak returns → reopen detour, invalidate prior "leak resolved" evidence, require replacement/pipe prep.
* Stable resume to "Final Inspection Bundle" only after validity=VALID.
  **Field user sees:** "📎 Leak correction: stop valve—upload before/after + dry paper towel test photo."
  **Admin sees:** Detour escalated; downstream tasks show "cannot finalize" guard.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=PlumbFinal + RESUME_TARGET=FinalBundle + VALIDITY={PlumbFinal:PROVISIONAL}
  **Break risk:** Evidence conflict (one tech uploads "dry" photo, later tech uploads new leak photo).
  **Guardrail:** If conflicting evidence uploaded, system forces "Admin review required" before allowing detour resolution (still within detour + validity overlay).
  **Angle of the angle:** Customer turns water on for move-in, causing pressure spike and revealing the true failure again.

---

5. **Roofing Punch List: Flashing at PV Roof Penetration Leaks After Rain**
   **Trade / Context:** Roofing + Solar interface. Roof completed; PV installed; a storm hits; interior finishes underway. (Downstream started: drywall/paint; also PV commissioning.)
   **Trigger:** Water intrusion traced to flashing/penetration sealing—common failure point in roofing errors. ([AWP Home Inspections][5])
   **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="Roof Closeout" for flashing rework + hose test documentation.
* If active leak threatens interior finishes/electrical → **escalate to BLOCKING** (halts "Interior Paint Final" and "PV Commissioning").
* Symptom-not-cause: re-caulk alone "works" until next rain; repeat detour opens again; after second repeat, admin forces **Remediation Loop** to re-run "Penetration Flashing Method" step-by-step.
* Stable resume to "Interior Finish Final" once validity=VALID.
  **Field user sees:** "⚠️ Roof penetration correction—upload hose-test video + flashing photo." If repeat: "🔁 Repeat correction—prior fix failed; follow full flashing method."
  **Admin sees:** Repeat detour count triggers "Root cause suspected" banner; can force remediation loop (admin intervention #1).
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=RoofCloseout + RESUME_TARGET=InteriorFinishFinal + VALIDITY={RoofCloseout:PROVISIONAL}
  **Break risk:** Non-blocking allowed too long; interior damage grows while system says "continue other work."
  **Guardrail:** If "water intrusion" tagged, system auto-escalates to BLOCKING.
  **Angle of the angle:** Weather prevents proper sealing cure window; material lead time on correct flashing kit.

---

6. **Framing Inspection Fails: Missing Fire Blocking in Soffit Chase**
   **Trade / Context:** Framing, pre-drywall inspection. Electrical rough partly done; HVAC ducts already hung. (Downstream started: rough-ins.)
   **Trigger:** Inspector flags missing/inadequate fire blocking—a common pre-drywall issue. ([Hope Home Inspections][6])
   **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="Framing Inspection" to install fire blocking and upload photo set.
* Because downstream rough-ins depend on framing being "inspection-ready," detour quickly escalates to **BLOCKING** if it requires opening ducts/wires already installed.
* User error: crew marks fire blocking "done" but forgets to re-run framing validation photos → detour remains ACTIVE; stable resume can't happen.
* Stable resume to "Drywall Release" only when framing validity=VALID.
  **Field user sees:** "🛑 Correction required: add fire blocking in chase. Upload 4 photos. Drywall release is paused."
  **Admin sees:** Dependency note: "HVAC/Electrical already installed; correction impacts rework risk."
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=FramingInspection + RESUME_TARGET=DrywallRelease + VALIDITY={FramingInspection:PROVISIONAL}
  **Break risk:** Teams keep installing insulation/drywall because they don't see why they're blocked.
  **Guardrail:** Blocked successor node shows "Blocked by: active correction at Framing Inspection" with one-tap jump to detour tasks.
  **Angle of the angle:** AHJ requests additional photos of concealed areas before they'll re-inspect.

---

7. **Concrete Pour Delayed: Rebar Spacing/Chairing Fails Pre-Pour Inspection**
   **Trade / Context:** Concrete/foundation. Excavation done; forms set; plumbing sleeves placed; pour scheduled with pump truck. (Downstream started: scheduling + rebar crew mobilized.)
   **Trigger:** Pre-pour inspector rejects rebar spacing/cover or mat separation—common rebar inspection fail. ([SJ Construction Consulting, LLC][7])
   **System behavior:**

* Start **DETOUR (blocking)** at CHECKPOINT="Pre-Pour Inspection" because proceeding risks structural defect.
* Reopen "Tie rebar to correct spacing," "Install proper chairs/dobies," and require photo evidence with tape measure.
* Symptom-not-cause: crew adds chairs but subgrade settles; spacing fails again → repeat detour; after second fail, admin forces remediation loop to re-run "Base prep compaction check" (admin intervention #2).
* Stable resume to "Pour Concrete" when validity=VALID.
  **Field user sees:** "🛑 Pour paused. Fix rebar spacing/cover; upload 8 photos with tape measure."
  **Admin sees:** Cost/schedule impact warning; pump truck reschedule note.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=PrePour + RESUME_TARGET=Pour + VALIDITY={PrePour:PROVISIONAL}
  **Break risk:** Someone tries to "resolve detour" just to keep schedule, causing long-tail liability.
  **Guardrail:** Blocking detour cannot be resolved without required evidence types + supervisor confirmation.
  **Angle of the angle:** Weather window closing; concrete supplier requires new slot; owner pushes to pour anyway.

---

8. **Low-Voltage Fire Alarm Rough-In: Voltage Drop Causes Device Failures**
   **Trade / Context:** Low-voltage/security/fire alarm rough-in on multi-unit. Drywall scheduled; electricians already pulled power. (Downstream started: drywall scheduling.)
   **Trigger:** System tests show devices failing due to wire gauge/distance causing voltage drop—common low-voltage mistake. ([Wolverine Low Voltage][8])
   **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="Fire Alarm Rough-In Test" to correct cable gauge/run, re-terminate, and re-test.
* Mid-way, AHJ/fire marshal requests proof of compliance / test report → detour escalates to **BLOCKING** because drywall cannot close without sign-off.
* Symptom-not-cause: tech replaces one device (symptom) but not wire run (cause) → repeat detour; after repeat, admin overrides to remediation loop for full circuit audit (admin intervention #3).
* Stable resume to "Close Walls" only when validity=VALID.
  **Field user sees:** "⚠️ Correction: voltage drop—replace run to proper gauge and re-test. Upload meter readings." Later: "🛑 Drywall blocked—AHJ requires test report."
  **Admin sees:** Detour escalated; shows "test report missing" and which evidence is required.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=FA_Test + RESUME_TARGET=Drywall + VALIDITY={FA_Test:PROVISIONAL}
  **Break risk:** Crew closes walls anyway; later open-up rework explodes.
  **Guardrail:** "Close Walls" tasks are not actionable when blocking detour is active.
  **Angle of the angle:** Night-only access for occupied tenants; crew swapped, new tech uploads conflicting test readings.

---

9. **Interior Paint Final: Adhesion Failure from High Humidity After "Quick Touch-Up"**
   **Trade / Context:** Painting/finishes, final touch-up. HVAC not fully commissioned; humidity high; cleaning crew booked. (Downstream started: cleaning + customer walkthrough scheduling.)
   **Trigger:** Paint peels/blisters due to moisture/humidity affecting adhesion—well-known cause of failure. ([Hoosier Boys Painting][9])
   **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="Paint Final" to sand/prime/recoat + document humidity reading.
* Symptom-not-cause: repainting without fixing humidity source leads to repeat detour; second repeat triggers remediation loop to re-run "Moisture source check" (HVAC drain, ventilation).
* Mid-way escalation to **BLOCKING** if homeowner walkthrough is imminent and defects are visible/contractual.
* Stable resume to "Final Walkthrough" when validity=VALID.
  **Field user sees:** "⚠️ Correction: adhesion failure—upload moisture/humidity reading + prep photos."
  **Admin sees:** Repeat detour suggests systemic cause; can require humidity threshold before allowing resolution.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=PaintFinal + RESUME_TARGET=Walkthrough + VALIDITY={PaintFinal:PROVISIONAL}
  **Break risk:** Field marks "done" prematurely (user error) without documenting conditions; defect returns.
  **Guardrail:** Detour resolution requires humidity reading photo or logged value plus before/after prep photos.
  **Angle of the angle:** HVAC start-up still provisional; moisture source may be condensate issue from Scenario #3.

---

10. **Irrigation/Backflow Inspection: Missing or Failing Backflow Preventer Test**
    **Trade / Context:** Landscaping/irrigation on residential. Sod installed; hardscape complete; city backflow test scheduled. (Downstream started: landscape completion + customer move-in.)
    **Trigger:** Backflow preventer fails test/leaks or missing device—common compliance issue; failures can be due to valves/relief issues/debris. ([Moore's Electrical & Mechanical][10])
    **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="Irrigation Inspection" to repair/replace backflow and upload certified test report.
* Escalate to **BLOCKING** if local policy requires passed backflow before final occupancy signoff / certificate (admin toggles policy mid-detour).
* Symptom-not-cause: replace relief valve but debris still in line → repeat detour.
* Stable resume to "Landscape Closeout" once validity=VALID.
  **Field user sees:** "📎 Correction: backflow—schedule test + upload report." If escalated: "🛑 Cannot close job until backflow passes."
  **Admin sees:** Policy override log; can't mark flow complete without report evidence.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=IrrigationInsp + RESUME_TARGET=LandscapeCloseout + VALIDITY={IrrigationInsp:PROVISIONAL}
  **Break risk:** Missing report upload; tech says "passed" but no proof.
  **Guardrail:** Require attachment type = "Certified Report PDF" before detour can resolve.
  **Angle of the angle:** Tester availability is two weeks out; customer waters lawn anyway and damages new sod during repair.

---

11. **Permit Revision Detour Becomes Blocking: AHJ Requests Engineering Letter Mid-Closeout**
    **Trade / Context:** Multi-trade (solar + electrical + structural). Install complete, inspection passed, closeout underway. (Downstream started: invoice, PTO paperwork.)
    **Trigger:** AHJ asks for additional documentation (engineering letter / revised calc) after a partial pass/clerical review—real permitting "quirk" behavior. (Also change orders/rework are common sources of delay.) ([Learn - ACD Operations][11])
    **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="Closeout Docs" to obtain letter + upload.
* Mid-way, utility PTO review rejects packet without that AHJ doc → detour escalates to **BLOCKING** (cannot proceed to PTO). PTO delays are common when paperwork is misaligned. ([GreenLancer][12])
* Stable resume to "PTO Submission" once validity=VALID.
  **Field user sees:** "📎 Additional doc needed—engineering letter requested." After escalation: "🛑 PTO blocked until uploaded."
  **Admin sees:** Detour escalation reason: "Utility PTO dependency." Can reassign task to engineer/vendor but cannot complete flow.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=CloseoutDocs + RESUME_TARGET=PTO_Submission + VALIDITY={CloseoutDocs:PROVISIONAL}
  **Break risk:** Team treats it as "paperwork later" and loses weeks.
  **Guardrail:** When detour touches PTO-critical document, system auto-escalates to BLOCKING and pins it at top of Work Station.
  **Angle of the angle:** Engineer lead time; customer demands system turned on without PTO (illegal), causing pressure.

---

12. **User Error: Wrong Evidence Uploaded for Electrical Panel Labeling**
    **Trade / Context:** Electrical, final. Panel labeling required; other trades (HVAC, plumbing) already finaled. (Downstream started: customer walkthrough scheduling.)
    **Trigger:** Technician uploads photos from the *wrong job*; inspector later fails labeling/identification issues (labeling is a common electrical inspection concern). ([Right Touch Electrical][13])
    **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="Electrical Final" to correct labels and re-upload.
* Mark prior labeling evidence **INVALID**; reopen upload task as actionable.
* Escalate to **BLOCKING** if inspection date is within 24 hours or if AHJ requires re-inspection appointment.
* Stable resume to "Final Bundle" only when validity=VALID.
  **Field user sees:** "⚠️ Evidence rejected: photos don't match job address/components. Re-upload required."
  **Admin sees:** Evidence mismatch alert; can't override validity without audit reason.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=ElecFinal + RESUME_TARGET=FinalBundle + VALIDITY={ElecFinal:PROVISIONAL, Evidence:INVALID}
  **Break risk:** If system allows admin to "force valid" too easily, it will be used and trust dies.
  **Guardrail:** Overrides require explicit admin note + cannot bypass external inspection requirement (still blocks completion).
  **Angle of the angle:** Crew swapped; new tech doesn't know what was done; customer access window is only evenings.

---

13. **Fix Symptom Not Cause: Solar PTO Delayed by Mismatched Paperwork vs As-Built**
    **Trade / Context:** Solar + admin closeout. Install and inspection complete; customer expects PTO. (Downstream started: billing + customer onboarding.)
    **Trigger:** Utility rejects PTO submission due to mismatched documents/system specs—common PTO delay cause. ([GreenLancer][12])
    **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="PTO Submission" to correct paperwork and re-submit.
* Symptom-not-cause: team corrects one form but not single-line or equipment serial mismatch → repeat detour. After second repeat, admin forces remediation loop of "PTO Packet Assembly QA" (re-run full checklist).
* Stable resume to "Utility Approval Wait" when validity=VALID.
  **Field user sees:** Usually nothing except "Awaiting PTO"—but if field photo needed (serial label), system creates actionable task: "Upload inverter serial photo."
  **Admin sees:** PTO rejection reason logged; repeat detour indicator; cannot mark job complete.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=PTO_Submission + RESUME_TARGET=UtilityApprovalWait + VALIDITY={PTO_Submission:PROVISIONAL}
  **Break risk:** If detours don't show *why* PTO is blocked, admin will "complete" anyway.
  **Guardrail:** Completion guard includes explicit "PTO rejected: mismatched docs" banner with required corrective tasks.
  **Angle of the angle:** Utility meter swap scheduling becomes the long pole; customer threatens chargeback.

---

14. **Join Node Block: Plumbing Passes, Electrical Passes, but Fire Alarm Detour Blocks CO**
    **Trade / Context:** Multi-trade convergence (plumbing, electrical, low-voltage/fire). Plumbing and electrical finals are VALID; fire alarm test fails. Join node is "Certificate of Occupancy Ready."
    **Trigger:** Fire alarm wiring fault or missing test documentation—wiring issues can arise from damage/poor installation. ([Advanced Security and Fire][14])
    **System behavior:**

* Start **DETOUR (blocking)** at CHECKPOINT="Fire Alarm Final Test."
* Allow plumbing/electrical branches to remain VALID and "complete," but block the **Join** activation/actionability until detour resolves (your "parallel branch convergence" rule).
* User error: tech fixes wiring but forgets to re-run final test step → detour remains ACTIVE and join stays blocked.
* Stable resume: Join node becomes actionable only when fire alarm validity=VALID.
  **Field user sees:** "🛑 CO blocked: Fire alarm test correction required. Complete retest checklist."
  **Admin sees:** Dashboard shows Join blocked by detour; can reassign tasks but can't override CO readiness without resolving detour.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=FA_FinalTest + RESUME_TARGET=CO_ReadyJoin + VALIDITY={FA_FinalTest:PROVISIONAL}
  **Break risk:** Teams argue because "my trade is done" but job can't close; blame game.
  **Guardrail:** Join node displays explicit dependency list showing which detour blocks it and why.
  **Angle of the angle:** Occupied building: only nighttime testing allowed; AHJ wants witness test.

---

15. **Admin Policy Change Mid-Detour: Non-Blocking Closeout Correction Becomes Blocking**
    **Trade / Context:** Closeout across trades; minor missing photo/signature. Work mostly complete; invoice ready; customer wants handoff.
    **Trigger:** Admin discovers repeated closeout misses and changes policy: all CLOSEOUT_ONLY detours must be blocking if within 48 hours of "handoff" milestone (change-order style process delays are a known problem when approvals/workflows are inconsistent). ([CIPO Cloud Software][15])
    **System behavior:**

* Existing **DETOUR (non-blocking)** at CHECKPOINT="Closeout Package" is escalated to **BLOCKING** by admin action.
* Mark closeout outcome PROVISIONAL; reopen missing evidence task(s) as actionable.
* Stable resume remains "Customer Handoff," but now blocked until detour resolves.
* Symptom-not-cause possibility: team uploads any photo to satisfy checkbox; later customer complains documentation incomplete → repeat detour or remediation loop for closeout QA.
  **Field user sees:** "Policy update: Closeout corrections now block handoff. Upload required items."
  **Admin sees:** Policy change audit entry; list of affected jobs with escalated detours; cannot revert without another explicit policy change.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=CloseoutPackage + RESUME_TARGET=CustomerHandoff + VALIDITY={CloseoutPackage:PROVISIONAL}
  **Break risk:** If policy changes are not auditable, teams feel "system is random," killing trust.
  **Guardrail:** Every escalation shows "Who/When/Why" and pins the policy rule text on the detour record.
  **Angle of the angle:** Customer reschedules walkthrough; crew is booked; missing signature requires homeowner present.

---

## Scenarios 16–20 (Extended Pressure-Tests)

16. **Customer Change Order Mid-Detour: Scope Change Invalidates the Fix**
    **Trade / Context:** Electrical + Solar PV. Final inspection failed for labeling; non-blocking detour already open. (Downstream started: closeout + PTO paperwork.)
    **Trigger:** While the labeling detour is active, the customer approves a change order upgrading to a different inverter model, changing equipment specs mid-correction (very common late-stage change order behavior).
    **System behavior:**

* Existing detour remains ACTIVE at CHECKPOINT="Final Inspection."
* New inverter change **invalidates the detour's assumption** (labels tied to old model).
* System marks all detour evidence **INVALID**.
* Because the change alters routing-critical data (equipment spec), system **blocks detour resolution** and requires conversion to **Remediation Loop**.
* Stable Resume is abandoned only because detour was explicitly converted.
  **Field user sees:** "⚠️ Scope changed. Current correction no longer applies. This requires restarting the inspection process with updated equipment."
  **Admin sees:** Change Order linked to active detour; forced remediation conversion logged. Cannot revert without new change order reversal.
  **Flow state:** ACTIVE + REMEDIATION_REQUIRED + CHECKPOINT=FinalInspection + VALIDITY={FinalInspection:INVALID}
  **Break risk:** If the system lets the detour resolve anyway, PTO paperwork is wrong and utility rejection follows weeks later.
  **Guardrail:** Any scope change touching **routing-critical fields** auto-invalidates active detours and blocks resolution.
  **Angle of the angle:** Customer expects "just paperwork," but utility treats equipment mismatch as a full re-review.

---

17. **Material Lead-Time Detour: Fix Is Correct but Parts Are Backordered**
    **Trade / Context:** HVAC. Start-up fails due to defective control board. Home is otherwise complete; customer moved in. (Downstream started: closeout.)
    **Trigger:** Replacement control board required; manufacturer lead time is 3–4 weeks (common HVAC parts issue).
    **System behavior:**

* Start **DETOUR (non-blocking)** at CHECKPOINT="HVAC Start-Up."
* Mark HVAC Start-Up outcome **PROVISIONAL**.
* Allow administrative closeout tasks to continue, but block Flow COMPLETED.
* Detour remains ACTIVE for extended duration without escalation.
* Stable Resume remains defined but unreachable until part arrives.
  **Field user sees:** "⏳ Waiting on parts: control board ETA 21 days. Job cannot close until installed."
  **Admin sees:** Detour duration warning ("open >14 days"); revenue recognition blocked.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=HVAC_StartUp + RESUME_TARGET=FinalCloseout + VALIDITY={HVAC_StartUp:PROVISIONAL}
  **Break risk:** Teams forget about long-running detours; jobs appear "done" but never close.
  **Guardrail:** Detours exceeding time threshold surface persistent banners and appear in a "Stalled Corrections" list.
  **Angle of the angle:** Temporary workaround installed (portable AC), tempting crew to mark HVAC "done" prematurely.

---

18. **AHJ Re-Inspection Delay: Slot Unavailable for 10 Days**
    **Trade / Context:** Plumbing final. Leak fixed; detour tasks completed. Re-inspection required. (Downstream finished.)
    **Trigger:** AHJ re-inspection scheduling backlog; next available slot is 10 days out (very common).
    **System behavior:**

* Detour tasks marked complete, but **detour remains ACTIVE** pending external event.
* Plumbing Final outcome stays **PROVISIONAL**.
* Stable Resume cannot occur until inspection PASS outcome recorded.
* Flow COMPLETED remains blocked with explicit reason.
  **Field user sees:** "🕒 Awaiting city re-inspection (scheduled for May 18). No further field work required."
  **Admin sees:** External dependency badge; can't override completion.
  **Flow state:** ACTIVE + DETOUR_OPEN + CHECKPOINT=PlumbFinal + RESUME_TARGET=Closeout + VALIDITY={PlumbFinal:PROVISIONAL}
  **Break risk:** If admins can force completion, certificate of occupancy risk emerges.
  **Guardrail:** External inspection outcomes are detour-closing events and cannot be bypassed by manual completion.
  **Angle of the angle:** Customer pressures for early move-in; risk of legal exposure if CO issued prematurely.

---

19. **Multi-Unit Flow Group: One Unit Fails, Others Pass**
    **Trade / Context:** Electrical inspections for a 6-unit apartment building. Units 1–5 pass. Unit 6 fails bonding.
    **Trigger:** Unit 6 fails inspection due to grounding error; others unaffected.
    **System behavior:**

* Start **DETOUR (blocking)** for FlowInstance=Unit6 at CHECKPOINT="Electrical Final."
* Units 1–5 remain VALID and COMPLETE.
* FlowGroup cannot reach COMPLETED until Unit6 detour resolves.
* Stable Resume applies only within Unit6 flow.
  **Field user sees:** "Unit 6: 🛑 Correction required—bonding fix. Other units are complete."
  **Admin sees:** FlowGroup dashboard shows 5/6 complete; 1 blocked by detour.
  **Flow state:** FLOWGROUP_ACTIVE + UNIT6_DETOUR_OPEN + CHECKPOINT=ElecFinal + VALIDITY={Unit6:PROVISIONAL}
  **Break risk:** If FlowGroup completion logic is naive, system may mark project complete incorrectly.
  **Guardrail:** FlowGroup completion requires **all child flows** to have zero ACTIVE detours.
  **Angle of the angle:** Tenant move-ins scheduled for completed units; pressure to ignore Unit 6.

---

20. **Safety Misclassification Near-Miss: Non-Blocking Should Have Been Blocking**
    **Trade / Context:** Electrical service upgrade. Minor panel labeling detour marked non-blocking. (Downstream work continues.)
    **Trigger:** While correcting labels, technician discovers **loose service conductor**—a serious safety issue often found during rework.
    **System behavior:**

* Active detour escalated from NON_BLOCKING → BLOCKING by field supervisor.
* Successor nodes immediately become non-actionable.
* All downstream outcomes remain VALID but **cannot finalize**.
* Stable Resume preserved once correction + re-inspection complete.
  **Field user sees:** "🛑 Safety issue discovered. Work paused until service conductors are secured and inspected."
  **Admin sees:** Escalation log + severity change reason. Cannot downgrade without admin action.
  **Flow state:** ACTIVE + DETOUR_OPEN(BLOCKING) + CHECKPOINT=ServiceUpgrade + RESUME_TARGET=Inspection + VALIDITY={ServiceUpgrade:PROVISIONAL}
  **Break risk:** If escalation is slow or unclear, someone could energize an unsafe system.
  **Guardrail:** Any safety-tagged finding **forces BLOCKING** detour with immediate downstream lock.
  **Angle of the angle:** Utility scheduled meter set the next morning; escalation prevents catastrophic energization.

---

## Why Scenarios 16–20 Matter

These cover **what the original 15 didn't fully stress**:

* Customer-driven scope mutation (16)
* Long-running detours (17)
* External scheduling dependencies (18)
* Multi-instance aggregation truth (19)
* Safety misclassification correction (20)

Together, they **pressure-test Stable Resume harder than happy-path logic ever will**.

---

## Constraint Check (Coverage Validation)

* **Exactly 20 scenarios:** ✅
* **≥ 8 trades covered:** Solar PV, Electrical, HVAC, Plumbing, Roofing, Framing, Concrete, Low-Voltage/Fire Alarm, Painting/Finishes, Landscaping/Irrigation ✅
* **≥ 5 "downstream already started":** #1, #2, #3, #4, #5, #9, #11, #12, #13, #16, #17 ✅
* **≥ 5 non-blocking → blocking escalations:** #2, #3, #4, #5, #6, #8, #9, #10, #11, #12, #15, #20 ✅
* **≥ 5 "fix symptom not cause":** #3, #4, #5, #7, #8, #9, #13, #15 ✅
* **≥ 3 admin interventions:** #5, #7, #8, #15 ✅
* **≥ 3 user errors:** #6, #12, #14 (also #4/#9 possible) ✅

---

[1]: https://nvcogct.gov/wp-content/uploads/2023/12/Residential-Rooftop-PV-Field-Inspections-Training-12.08.2023.pdf "Introduction to Residential Rooftop PV Field Inspections"
[2]: https://shaffercon.com/industry-insights/passing-electrical-inspection-common-failures-fixes "Passing Electrical Inspection: Common Failures and How to Fix"
[3]: https://www.homeinspector.org/reporter-articles/understanding-condensate/ "Understanding Condensate"
[4]: https://gopaschal.com/resources/plumbing-inspection-failure-reasons/ "10 Common Reasons You Might Fail a Plumbing Inspection"
[5]: https://awphomeinspections.com/common-roofing-errors/ "Common Roofing Errors"
[6]: https://www.hopehomeinspections.com/inspection-information/15-common-issues-found-during-pre-drywall-inspections/ "15 Common Issues Found During Pre-Drywall Inspections"
[7]: https://sjcivil.com/common-rebar-inspection-fails/ "Common Rebar Inspection Fails"
[8]: https://wolverinelowvoltage.com/blog/low-voltage-wiring-installation-mistakes/ "Top 10 Common Low Voltage Wiring Installation Mistakes"
[9]: https://hoosierboyspainting.com/how-to-protect-painted-surfaces-from-humidity/ "Protect Painted Surfaces From Humidity"
[10]: https://mooreselectric.com/4-reason-your-backflow-may-have-failed-inspection/ "Backflow Testing Inspection Failed: 4 Possible Causes"
[11]: https://learn.aiacontracts.com/articles/6378493-the-fundamentals-of-change-orders-in-construction/ "The Fundamentals of Change Orders in Construction"
[12]: https://www.greenlancer.com/post/solar-pto "Understanding Solar PTO (Permission to Operate)"
[13]: https://www.righttouchelectrical.com/electrical-services/home-safety-inspections/electrical-inspections/ "13 Reasons Homes Fail Electrical Inspections"
[14]: https://advancedsecurityandfire.com/how-to-detect-and-fix-faulty-fire-alarm-wiring/ "How to Detect and Fix Faulty Fire Alarm Wiring"
[15]: https://ciposoftware.com/2025/11/05/why-construction-change-orders-cause-delays/ "Why Construction Change Orders Can Cause Delays"
