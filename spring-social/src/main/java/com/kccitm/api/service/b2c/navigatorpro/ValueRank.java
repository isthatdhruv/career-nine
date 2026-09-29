package com.kccitm.api.service.b2c.navigatorpro;

/**
 * One ranked option of the Work Values question: rank 1 = most important. v3 joins
 * on the option's value tag (its MQT name, e.g. "Pay &amp; benefits"), never on free text.
 */
public final class ValueRank {
    public final int rank;
    public final String tag;
    public final String optionText;

    public ValueRank(int rank, String tag, String optionText) {
        this.rank = rank;
        this.tag = tag;
        this.optionText = optionText;
    }
}
