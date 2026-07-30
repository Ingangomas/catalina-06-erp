import { describe, expect, it } from "vitest";
import { expectedExpenseOwnerType, normalizeAuthorizedEmail, pendingOpenIdForEmail } from "./identityProfiles";

describe("perfiles autorizados del proyecto", () => {
  it("normaliza los correos para reconocer una identidad autorizada aunque cambie el uso de mayúsculas", () => {
    expect(normalizeAuthorizedEmail(" Ing.JohanNunez@Gmail.com ")).toBe("ing.johannunez@gmail.com");
  });

  it("genera una identidad provisional estable para usuarios autorizados que aún no han iniciado sesión", () => {
    expect(pendingOpenIdForEmail("contabilidad@constructoraangote.com")).toBe("pending:contabilidad@constructoraangote.com");
  });

  it("asocia cada tipo personal de gasto con el titular correspondiente", () => {
    expect(expectedExpenseOwnerType("socio_1")).toBe("socio_1");
    expect(expectedExpenseOwnerType("socio_2")).toBe("socio_2");
    expect(expectedExpenseOwnerType("participant")).toBe("participante");
    expect(expectedExpenseOwnerType("global_shared")).toBeNull();
  });
});
