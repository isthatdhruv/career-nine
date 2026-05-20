package com.kccitm.api.service.b2c.pager;

/**
 * Holland-code RIASEC personality type. Mirrors the TS enum in
 * {@code react-social/.../Navigator360Types.ts}.
 */
public enum RiasecType {
    R, I, A, S, E, C;

    public String label() {
        switch (this) {
            case R: return "Realistic";
            case I: return "Investigative";
            case A: return "Artistic";
            case S: return "Social";
            case E: return "Enterprising";
            case C: return "Conventional";
            default: return name();
        }
    }
}
