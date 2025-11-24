package com.kccitm.api.model;
import java.io.Serializable;

@Entity
@Table(name = "owner")
public class Owner implements Serializable{
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    private String ownerName;

    @NotNull
    private String ownerEmail;

    private String ownerPhone;

    @ManyToMany(mappedBy = "owners", fetch = FetchType.LAZY)
    @JsonBackReference
    private Set<InstituteDetail> institutes = new HashSet<>();

    public Long getId() {
        return id;
    }
    public void setId(Long id) {
        this.id = id;
    }
    public String getOwnerName() {
        return ownerName;
    }
    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }
    public String getOwnerEmail() {
        return ownerEmail;
    }
    public void setOwnerEmail(String ownerEmail) {
        this.ownerEmail = ownerEmail;
    }
    public String getOwnerPhone() {
        return ownerPhone;
    }
    public void setOwnerPhone(String ownerPhone) {
        this.ownerPhone = ownerPhone;
    }

    public Set<InstituteDetail> getInstitutes() {
        return institutes;
    }
    public void setInstitutes(Set<InstituteDetail> institutes) {
        this.institutes = institutes;
    }
    
}