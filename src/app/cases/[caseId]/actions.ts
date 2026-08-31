"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { measurementInputSchema } from "@/lib/domain/schema";

export interface MeasurementFormState {
  error?: string;
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function createMeasurement(
  caseId: string,
  productRevisionId: string,
  _prevState: MeasurementFormState,
  formData: FormData,
): Promise<MeasurementFormState> {
  const parsed = measurementInputSchema.safeParse({
    operatingMode: formData.get("operatingMode"),
    label: formData.get("label") || undefined,
    notes: formData.get("notes") || undefined,
    peak: {
      frequencyMhz: optionalNumber(formData.get("frequencyMhz")),
      marginDb: optionalNumber(formData.get("marginDb")),
      detector: formData.get("detector") || undefined,
      limitLine: formData.get("limitLine") || undefined,
    },
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { data: measurement, error: measurementError } = await supabase
    .from("measurements")
    .insert({
      failure_case_id: caseId,
      product_revision_id: productRevisionId,
      label: parsed.data.label ?? null,
      operating_mode: parsed.data.operatingMode,
      notes: parsed.data.notes ?? null,
      measured_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (measurementError || !measurement) {
    return { error: "Could not save the measurement." };
  }

  const { error: peakError } = await supabase.from("measurement_peaks").insert({
    measurement_id: measurement.id,
    frequency_mhz: parsed.data.peak.frequencyMhz,
    margin_db: parsed.data.peak.marginDb,
    detector: parsed.data.peak.detector ?? null,
    limit_line: parsed.data.peak.limitLine ?? null,
  });
  if (peakError) {
    // Compensate: don't leave a measurement with no reading behind.
    await supabase.from("measurements").delete().eq("id", measurement.id);
    return { error: "Could not save the measured peak." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("investigation_events").insert({
      failure_case_id: caseId,
      event_type: "measurement_recorded",
      description: `Measurement recorded: ${parsed.data.peak.frequencyMhz} MHz at ${parsed.data.peak.marginDb} dB (${parsed.data.operatingMode}).`,
      created_by: user.id,
      payload: { measurement_id: measurement.id },
    });
  }

  revalidatePath(`/cases/${caseId}`);
  return {};
}
