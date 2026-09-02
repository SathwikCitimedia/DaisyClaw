/* @vitest-environment jsdom */

// Control UI tests cover the contact-import parsers (CSV, vCard, plain text)
// and the allowed-contacts delete flow (confirm dialog + toast).
import { render } from "lit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installDialogPolyfill } from "../../test-helpers/modal-dialog.ts";
import { extractContactsFromText, renderAllowedContactsSection } from "./channels.contacts.ts";
import type { ChannelsProps } from "./channels.types.ts";

describe("extractContactsFromText", () => {
  it("reads a Google Contacts export: header row, quoted cells, multiple phone columns", () => {
    const csv = [
      '"Name","Given Name","Family Name","E-mail 1 - Value","Phone 1 - Type","Phone 1 - Value","Phone 2 - Type","Phone 2 - Value"',
      '"Aasrith Varma","Aasrith","Varma","aasrith@gmail.com","Mobile","+91 93812 41869","Home","+91 40 1234 5678"',
      '"Abhinash","Abhinash","","abhi@x.com","Mobile","+91 63058 65365","",""',
    ].join("\r\n");

    const contacts = extractContactsFromText(csv, "+91");

    expect(contacts).toEqual([
      { number: "+919381241869", name: "Aasrith Varma" },
      { number: "+914012345678", name: "Aasrith Varma" },
      { number: "+916305865365", name: "Abhinash" },
    ]);
  });

  it('splits Google\'s " ::: " multi-value phone cells and names every number', () => {
    const csv = ["Name,Phone 1 - Value", "Aasrith,+91 93812 41869 ::: +91 91234 56789"].join("\n");

    const contacts = extractContactsFromText(csv, "+91");

    expect(contacts).toEqual([
      { number: "+919381241869", name: "Aasrith" },
      { number: "+919123456789", name: "Aasrith" },
    ]);
  });

  it("reads an Outlook export: First/Last name columns and Mobile Phone", () => {
    const csv = [
      "First Name,Last Name,E-mail Address,Mobile Phone,Business Phone",
      "Aasrith,Varma,aasrith@x.com,+91 93812 41869,",
      "Sam,,sam@x.com,,+1 (555) 010-9999",
    ].join("\n");

    const contacts = extractContactsFromText(csv, "+91");

    expect(contacts).toEqual([
      { number: "+919381241869", name: "Aasrith Varma" },
      { number: "+15550109999", name: "Sam" },
    ]);
  });

  it("pairs names in a simple headerless name,number file and ignores email cells", () => {
    const csv = [
      "Aasrith,93812 41869,aasrith@gmail.com",
      "Abhinash,+91 63058 65365",
      "99887 76655",
    ].join("\n");

    const contacts = extractContactsFromText(csv, "+91");

    expect(contacts).toEqual([
      { number: "+919381241869", name: "Aasrith" },
      { number: "+916305865365", name: "Abhinash" },
      { number: "+919988776655" },
    ]);
  });

  it("leaves numbers unnamed when a headerless row has ambiguous text cells", () => {
    const contacts = extractContactsFromText("Aasrith,Hyderabad Office,93812 41869", "+91");

    expect(contacts).toEqual([{ number: "+919381241869" }]);
  });

  it("still handles numbers-only text files", () => {
    const contacts = extractContactsFromText("+91 93812 41869\n0 63058 65365", "+91");

    expect(contacts).toEqual([{ number: "+919381241869" }, { number: "+916305865365" }]);
  });

  it("reads vCard exports with FN names", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Varma;Aasrith;;;",
      "FN:Aasrith Varma",
      "TEL;TYPE=CELL:+91 93812 41869",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:;Abhinash;;;",
      "TEL:+91 63058 65365",
      "END:VCARD",
    ].join("\r\n");

    const contacts = extractContactsFromText(vcf, "+91");

    expect(contacts).toEqual([
      { number: "+919381241869", name: "Aasrith Varma" },
      { number: "+916305865365", name: "Abhinash" },
    ]);
  });

  it("dedupes repeated numbers and keeps the named entry", () => {
    const csv = ["+91 93812 41869", "Aasrith,+91 93812 41869"].join("\n");

    const contacts = extractContactsFromText(csv, "+91");

    expect(contacts).toEqual([{ number: "+919381241869", name: "Aasrith" }]);
  });
});

describe("allowed contacts delete flow", () => {
  let container: HTMLElement;
  let restoreDialog: () => void;

  beforeEach(() => {
    restoreDialog = installDialogPolyfill();
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    restoreDialog();
    document.body.innerHTML = "";
  });

  function createProps(overrides: Partial<ChannelsProps> = {}): ChannelsProps {
    return {
      configForm: {
        channels: {
          whatsapp: {
            allowFrom: ["+911112223334"],
            contactLabels: { "+911112223334": "Aasrith" },
          },
        },
      },
      contactsBusy: null,
      contactsBusyOp: null,
      contactsError: null,
      contactEditKey: null,
      onContactRemove: vi.fn(async () => true),
      onContactRename: vi.fn(),
      onContactEditStart: vi.fn(),
      onContactEditCancel: vi.fn(),
      onDmPolicyChange: vi.fn(),
      onContactAdd: vi.fn(),
      onContactsAdd: vi.fn(),
      ...overrides,
    } as unknown as ChannelsProps;
  }

  function renderSection(props: ChannelsProps) {
    render(renderAllowedContactsSection({ channelId: "whatsapp", props }), container);
  }

  it("deletes only after the user confirms, then shows a success toast", async () => {
    const props = createProps();
    renderSection(props);

    const deleteBtn = container.querySelector<HTMLButtonElement>(".contacts-list__delete");
    expect(deleteBtn?.textContent?.trim()).toBe("Delete");
    deleteBtn!.click();

    const dialog = document.querySelector("dialog.confirm-dialog");
    expect(dialog, "confirm dialog should open before deleting").toBeTruthy();
    expect(dialog?.textContent).toContain("Aasrith (+911112223334)");
    expect(props.onContactRemove).not.toHaveBeenCalled();

    const confirm = dialog!.querySelector<HTMLButtonElement>("button.btn.danger");
    confirm!.click();

    await vi.waitFor(() => {
      expect(props.onContactRemove).toHaveBeenCalledWith("whatsapp", "+911112223334");
      const toast = document.querySelector(".toast--success");
      expect(toast?.textContent).toContain("Aasrith (+911112223334) deleted");
    });
  });

  it("does not delete when the user cancels", async () => {
    const props = createProps();
    renderSection(props);

    container.querySelector<HTMLButtonElement>(".contacts-list__delete")!.click();
    const dialog = document.querySelector("dialog.confirm-dialog");
    const cancel = Array.from(dialog!.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Cancel",
    );
    cancel!.click();

    // The jsdom dialog polyfill doesn't fire the `close` event that removes
    // the element in real browsers — closed (`open` cleared) is the signal.
    await vi.waitFor(() => {
      expect(document.querySelector("dialog.confirm-dialog[open]")).toBeNull();
    });
    expect(props.onContactRemove).not.toHaveBeenCalled();
    expect(document.querySelector(".toast--success")).toBeNull();
  });

  it("shows an error toast when the removal fails", async () => {
    const props = createProps({
      onContactRemove: vi.fn(async () => false) as ChannelsProps["onContactRemove"],
    });
    renderSection(props);

    container.querySelector<HTMLButtonElement>(".contacts-list__delete")!.click();
    document
      .querySelector("dialog.confirm-dialog")!
      .querySelector<HTMLButtonElement>("button.btn.danger")!
      .click();

    await vi.waitFor(() => {
      const toast = document.querySelector(".toast--error");
      expect(toast?.textContent).toContain("Couldn't delete");
    });
  });
});
