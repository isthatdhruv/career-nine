package com.kccitm.api.service.b2c.navigatorpro;

/** One ranked option of the Work Values question: rank 1 = most important. */
public final class ValueRank {
    public final int rank;
    public final String optionText;

    public ValueRank(int rank, String optionText) {
        this.rank = rank;
        this.optionText = optionText;
    }
}
