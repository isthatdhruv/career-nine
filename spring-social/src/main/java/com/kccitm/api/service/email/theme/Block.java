package com.kccitm.api.service.email.theme;

public abstract class Block {
    public abstract String html();
    public abstract String text();
    public boolean isPrimaryAction() { return false; }
    public boolean isSecondaryAction() { return false; }
}
