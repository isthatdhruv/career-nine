package com.kccitm.api.model.career9;
import java.io.Serializable;
import java.util.HashSet;
import java.util.Set;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.ManyToMany;
import javax.persistence.Table;

@Entity
@Table(name = "tools")
public class Tool implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tool_id")
    private Long tool_id;
    
    @Column(name = "name")
    private String name;
    
    @Column(name = "price")
    private Double price;
    
    @Column(name = "is_free")
    private boolean isFree;

    // Many-to-Many relationship with MeasuredQualities
    @ManyToMany
    @JoinTable(
        name="tool_measured_quality_mapping",
        joinColumns = @JoinColumn(name="tool_id"),
        inverseJoinColumns = @JoinColumn(name="measured_quality_id")
    )
    private Set<MeasuredQualities> measuredQualities = new HashSet<>();

    // Getters and Setters

    public Long getToolId() {
        return tool_id;
    }

    public void setToolId(Long tool_id) {
        this.tool_id = tool_id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Double getPrice() {
        return price;
    }

    public void setPrice(Double price) {
        this.price = price;
    }

    public boolean isFree() {
        return isFree;
    }
    
    public void setFree(boolean isFree) {
        this.isFree = isFree;
    }

}