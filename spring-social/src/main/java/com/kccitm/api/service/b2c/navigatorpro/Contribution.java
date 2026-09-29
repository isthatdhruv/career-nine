package com.kccitm.api.service.b2c.navigatorpro;

/** One answered question's score under one construct (reversal already applied in the stored score). */
public final class Contribution {
    public final String construct;
    public final long questionId;
    public final int score;

    public Contribution(String construct, long questionId, int score) {
        this.construct = construct;
        this.questionId = questionId;
        this.score = score;
    }
}
