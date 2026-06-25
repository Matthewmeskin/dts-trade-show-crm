/**
 * Path: lib/move-out/MoveOutForm.tsx
 * Built with @react-pdf/renderer so it runs in a Next.js route / server action.
 *   import { renderMoveOutForm } from "./MoveOutForm";
 *   const buffer = await renderMoveOutForm(shipment);   // returns a PDF Buffer
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

/* ----------------------------- Brand constants ---------------------------- */

const DTS = {
  maroon: "#AB0534",
  blue: "#0063A0",
  darkBlue: "#33658A",
  lightBlue: "#86BBD8",
  grey: "#F4F4F4",
  midGrey: "#818181",
};

// Default bill-to. Overridable per carrier profile / per load.
export const DTS_BILL_TO: Party = {
  company: "Diversified Transportation Services",
  address1: "19829 Hamilton Avenue",
  city: "Torrance",
  state: "CA",
  zip: "90502",
};

/* --------------------------------- Types ---------------------------------- */

export interface Party {
  company: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  attn?: string;
  specialInstructions?: string;
}

export interface MoveOutShipment {
  showName: string;
  booth?: string;
  exhibitorCompany: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;

  // SHIP TO = the consignee on the load
  shipTo: Party;

  // BILL TO = defaults to DTS; can be overridden per carrier profile or load
  billTo?: Party;

  // Carrier (prints under "Other Carrier")
  carrier: { name: string; phone?: string };

  levelOfService?: "ground" | "1day" | "2day" | "deferred" | "specialized";

  accessorials?: {
    loadingDock?: boolean;
    insideDelivery?: boolean;
    liftgate?: boolean;
    residential?: boolean;
    padWrap?: boolean;
    doNotStack?: boolean;
    airRide?: boolean;
  };

  // Free-text lines (e.g. "Call before delivery") -> SPECIAL INSTRUCTIONS
  extraInstructions?: string[];

  numberOfLabels?: number;
}

/* -------------------------------- Styles ---------------------------------- */

const s = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 34,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    color: "#111",
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: DTS.maroon,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  callout: {
    marginTop: 6,
    backgroundColor: DTS.grey,
    borderLeftWidth: 3,
    borderLeftColor: DTS.maroon,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  calloutText: { fontSize: 8, color: "#222", lineHeight: 1.45 },
  band: {
    backgroundColor: DTS.blue,
    color: "#fff",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textAlign: "center",
    paddingVertical: 2.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
  },
  row: { flexDirection: "row", alignItems: "flex-end", marginTop: 5 },
  label: { fontFamily: "Helvetica-Bold", fontSize: 8, marginRight: 4 },
  fill: {
    flexGrow: 1,
    borderBottomWidth: 0.8,
    borderBottomColor: "#444",
    paddingBottom: 1,
    minHeight: 11,
  },
  fillText: { fontSize: 8.5 },
  checkRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  box: {
    width: 10,
    height: 10,
    borderWidth: 0.9,
    borderColor: "#333",
    marginRight: 5,
    padding: 1.6,
  },
  boxFill: { flex: 1, backgroundColor: DTS.maroon },
  checkLabel: { fontSize: 8 },
  col: { flex: 1 },
  twoCol: { flexDirection: "row", marginTop: 4 },
  subHead: { fontFamily: "Helvetica-Bold", fontSize: 8.5, marginTop: 6, marginBottom: 2 },
  failBox: { borderWidth: 0.9, borderColor: "#333", marginTop: 8, padding: 8 },
  failTitle: { fontFamily: "Helvetica-Bold", fontSize: 8, marginBottom: 4 },
});

/* ------------------------------ Small pieces ------------------------------ */

const Fill = ({ value, flex = 1 }: { value?: string; flex?: number }) => (
  <View style={[s.fill, { flexGrow: flex }]}>
    <Text style={s.fillText}>{value || " "}</Text>
  </View>
);

const LabeledFill = ({
  label,
  value,
  flex = 1,
}: {
  label: string;
  value?: string;
  flex?: number;
}) => (
  <View style={[s.row, { flexGrow: flex }]}>
    <Text style={s.label}>{label}</Text>
    <Fill value={value} />
  </View>
);

const Check = ({ checked, label }: { checked?: boolean; label: string }) => (
  <View style={s.checkRow}>
    <View style={s.box}>{checked ? <View style={s.boxFill} /> : null}</View>
    <Text style={s.checkLabel}>{label}</Text>
  </View>
);

const PartyBlock = ({ heading, p }: { heading: string; p: Party }) => {
  const cityLine = [p.city, p.state, p.zip].filter(Boolean).join("   ");
  return (
    <View>
      <View style={s.row}>
        <Text style={[s.label, { width: 46 }]}>{heading}</Text>
        <Fill value={p.company} />
      </View>
      <View style={s.row}>
        <Text style={[s.label, { width: 46 }]}>ADDRESS</Text>
        <Fill value={[p.address1, p.address2].filter(Boolean).join(", ")} />
      </View>
      <View style={s.row}>
        <Text style={s.label}>CITY / STATE / ZIP</Text>
        <Fill value={cityLine} />
      </View>
      {(p.phone || p.attn) && (
        <View style={s.twoCol}>
          <LabeledFill label="PHONE #" value={p.phone} flex={1.4} />
          <View style={{ width: 10 }} />
          <LabeledFill label="ATTN" value={p.attn} />
        </View>
      )}
    </View>
  );
};

/* -------------------------------- Document -------------------------------- */

export function MoveOutFormDoc({ shipment }: { shipment: MoveOutShipment }) {
  const billTo = shipment.billTo ?? DTS_BILL_TO;
  const los = shipment.levelOfService ?? "ground";
  const acc = shipment.accessorials ?? {};

  const siParts = [
    shipment.shipTo.specialInstructions,
    ...(shipment.extraInstructions ?? []),
  ].filter(Boolean) as string[];
  const shipToWithSI: Party = { ...shipment.shipTo, specialInstructions: undefined };

  return (
    <Document
      title={`Move-Out - ${shipment.exhibitorCompany} - ${shipment.showName}`}
      author="Diversified Transportation Services"
    >
      <Page size="LETTER" style={s.page}>
        <Text style={s.title}>Outbound Shipping Form - Action Required</Text>
        <View style={s.callout}>
          <Text style={s.calloutText}>
            Bring this form to the general contractor&apos;s exhibitor services desk (i.e. GES, Freeman,
            T3, etc.) and ask them to create the Material Handling Agreement and labels for you based
            on the information below. Double check the paperwork that the exhibitor service desk gives
            back to you. Make sure that the carrier is listed on the MHA exactly as we have displayed
            below, and that the billing points to Diversified Transportation Services.
          </Text>
        </View>

        <View style={s.row}>
          <Text style={s.label}>NAME OF SHOW</Text>
          <Fill value={shipment.showName} />
        </View>
        <View style={s.twoCol}>
          <LabeledFill label="COMPANY NAME" value={shipment.exhibitorCompany} flex={2} />
          <View style={{ width: 10 }} />
          <LabeledFill label="BOOTH #" value={shipment.booth} />
        </View>
        <View style={s.twoCol}>
          <LabeledFill label="CONTACT NAME" value={shipment.contactName} flex={1.6} />
          <View style={{ width: 10 }} />
          <LabeledFill label="PHONE #" value={shipment.contactPhone} />
        </View>
        <View style={s.row}>
          <Text style={s.label}>E-MAIL ADDRESS</Text>
          <Fill value={shipment.contactEmail} />
        </View>

        <Text style={s.band}>Shipping Information</Text>
        <PartyBlock heading="SHIP TO" p={shipToWithSI} />
        <View style={s.row}>
          <Text style={s.label}>SPECIAL INSTRUCTIONS</Text>
          <Fill value={siParts.join("  |  ")} />
        </View>

        <View style={{ height: 4 }} />
        <PartyBlock heading="BILL TO" p={billTo} />

        <Text style={s.band}>Method of Shipment</Text>
        <View style={s.twoCol}>
          <View style={s.col}>
            <Text style={s.subHead}>Carrier</Text>
            <Check checked label="Other Carrier" />
            <View style={[s.row, { marginTop: 1 }]}>
              <Text style={s.label}>CARRIER NAME</Text>
              <Fill value={shipment.carrier.name} />
            </View>
            <View style={s.row}>
              <Text style={s.label}>CARRIER PHONE</Text>
              <Fill value={shipment.carrier.phone} />
            </View>
          </View>
          <View style={{ width: 16 }} />
          <View style={s.col}>
            <Text style={s.subHead}>Level of Service</Text>
            <Check checked={los === "1day"} label="1 Day: next business day" />
            <Check checked={los === "2day"} label="2 Day: by 5:00 PM second business day" />
            <Check checked={los === "deferred"} label="Deferred: 3-5 business days" />
            <Check checked={los === "ground"} label="Standard Ground" />
            <Check checked={los === "specialized"} label="Specialized: pad wrapped / uncrated / TL" />
          </View>
        </View>

        <Text style={s.subHead}>Shipment Options</Text>
        <View style={s.twoCol}>
          <View style={s.col}>
            <Check checked={acc.loadingDock} label="Have loading dock" />
            <Check checked={acc.insideDelivery} label="Inside delivery" />
            <Check checked={acc.padWrap} label="Pad wrap required" />
            <Check checked={acc.doNotStack} label="Do not stack" />
          </View>
          <View style={{ width: 16 }} />
          <View style={s.col}>
            <Check checked={acc.liftgate} label="Lift gate required" />
            <Check checked={acc.airRide} label="Air ride required" />
            <Check checked={acc.residential} label="Residential" />
          </View>
        </View>
        <View style={[s.row, { marginTop: 2 }]}>
          <Text style={s.label}>DESIRED NUMBER OF LABELS</Text>
          <Fill value={shipment.numberOfLabels ? String(shipment.numberOfLabels) : undefined} />
        </View>

        <View style={s.failBox}>
          <Text style={s.failTitle}>
            IN THE EVENT THE SELECTED CARRIER FAILS TO SHOW ON FINAL MOVE-OUT DAY, SELECT ONE:
          </Text>
          <Check checked={false} label="1.  Re-route via show carrier's choice" />
          <Check checked={true} label="2.  Delivery back to warehouse at exhibitor's expense" />
          <View style={[s.row, { marginTop: 6 }]}>
            <Text style={s.label}>RE-ROUTE VIA</Text>
            <Fill value={undefined} flex={1.4} />
            <Text style={[s.label, { marginLeft: 8 }]}>BY</Text>
            <Fill value={undefined} />
          </View>
          <View style={s.twoCol}>
            <LabeledFill label="DATE" value={undefined} />
            <View style={{ width: 10 }} />
            <LabeledFill label="TIME" value={undefined} />
            <Text style={[s.label, { marginLeft: 8 }]}>AM / PM</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>CARRIER</Text>
            <Fill value={undefined} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Render to a PDF Buffer (use in an API route / server action). */
export async function renderMoveOutForm(shipment: MoveOutShipment): Promise<Buffer> {
  return renderToBuffer(<MoveOutFormDoc shipment={shipment} />);
}
