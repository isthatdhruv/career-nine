package com.kccitm.api.service.email.theme;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** A mail before rendering: subject, preheader and blocks. Immutable; build with {@link #builder()}. */
public final class Mail {
    private final String subject;
    private final String preheader;
    private final List<Block> blocks;

    private Mail(String subject, String preheader, List<Block> blocks) {
        this.subject = subject; this.preheader = preheader; this.blocks = Collections.unmodifiableList(new ArrayList<>(blocks));
    }
    public static Builder builder() { return new Builder(); }
    public String getSubject() { return subject; }
    public String getPreheader() { return preheader; }
    public List<Block> getBlocks() { return blocks; }
    public long primaryActions() { return blocks.stream().filter(Block::isPrimaryAction).count(); }
    public long secondaryActions() { return blocks.stream().filter(Block::isSecondaryAction).count(); }

    /** A value in bold, escaped. Use inside p()/small()/notice() text. */
    public static String b(String value) { return "<b>" + MailHtml.esc(value) + "</b>"; }
    /** A value escaped. */
    public static String v(String value) { return MailHtml.esc(value); }

    public static final class Row {
        public final String label;
        public final String value;
        public Row(String label, String value) { this.label = label; this.value = value; }
    }
    public static final class Step {
        public final String heading;
        public final String text;
        public Step(String heading, String text) { this.heading = heading; this.text = text; }
    }

    public static final class Builder {
        private String subject; private String preheader; private final List<Block> blocks = new ArrayList<>();
        public Builder subject(String s) { subject = s; return this; }
        public Builder preheader(String p) { preheader = p; return this; }
        public Builder title(String html) { blocks.add(new Blocks.Title(html)); return this; }
        public Builder p(String html) { blocks.add(new Blocks.Paragraph(html)); return this; }
        public Builder small(String html) { blocks.add(new Blocks.Small(html)); return this; }
        public Builder notice(String html) { blocks.add(new Blocks.Notice(html)); return this; }
        public Builder internal(String tag) { blocks.add(new Blocks.Internal(tag)); return this; }
        public Builder details(Row... rows) { blocks.add(new Blocks.Details(Arrays.asList(rows))); return this; }
        public Builder details(List<Row> rows) { blocks.add(new Blocks.Details(rows)); return this; }
        public Builder credentials(String caption, Row... rows) { blocks.add(new Blocks.Credentials(Arrays.asList(rows), caption)); return this; }
        public Builder code(String code, String caption) { blocks.add(new Blocks.Code(code, caption)); return this; }
        public Builder action(MailLink link, String label) { if (link != null) blocks.add(new Blocks.Action(link, label)); return this; }
        public Builder button(MailLink link, String label) { if (link != null) blocks.add(new Blocks.Button(link, label)); return this; }
        public Builder outline(MailLink link, String label) { if (link != null) blocks.add(new Blocks.Outline(link, label)); return this; }
        /** links(prefix, link1, label1, link2, label2 …) */
        public Builder links(String prefix, Object... linksAndLabels) {
            List<MailLink> l = new ArrayList<>(); List<String> lb = new ArrayList<>();
            for (int i = 0; i + 1 < linksAndLabels.length; i += 2) {
                if (linksAndLabels[i] == null) continue;
                l.add((MailLink) linksAndLabels[i]); lb.add((String) linksAndLabels[i + 1]);
            }
            if (!l.isEmpty()) blocks.add(new Blocks.Links(prefix, l, lb));
            return this;
        }
        public Builder list(String... items) { blocks.add(new Blocks.BulletList(Arrays.asList(items))); return this; }
        public Builder steps(Step... steps) { blocks.add(new Blocks.Steps(Arrays.asList(steps))); return this; }
        public Builder table(String[] header, List<String[]> rows) { blocks.add(new Blocks.Table(header, rows)); return this; }
        public Builder signature() { blocks.add(new Blocks.Signature()); return this; }
        public Mail build() { return new Mail(subject, preheader, blocks); }
    }
}
