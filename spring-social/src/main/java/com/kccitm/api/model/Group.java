package com.kccitm.api.model;
import java.io.Serializable;
import java.util.HashSet;
import java.util.Set;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToMany;
import javax.persistence.Table;





@Entity
@Table(name = "group_data")
public class Group implements Serializable{
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
	private int id;

	@Column(name="group_title")
	private String groupTitle;

	@Column(name="group_description")
	private String groupDescription;

    @JoinColumn(name = "user_owner_id", nullable = false)
	private User userOwnerId;

    @ManyToMany(mappedBy = "groups")
    private Set<User> users = new HashSet<>();

    public int getId() {
        return id;
    }
    public void setId(int id) {
        this.id = id;
    }
    public String getGroupTitle() {
        return groupTitle;
    }
    public void setGroupTitle(String groupTitle) {
        this.groupTitle = groupTitle;
    }
    public String getGroupDescription() {
        return groupDescription;
    }
    public void setGroupDescription(String groupDescription) {
        this.groupDescription = groupDescription;
    }
    public User getUserId() {
        return userOwnerId;
    }
    public void setUserId(User userId) {
        this.userOwnerId = userId;
    }
    public Set<User> getUsers() {
    return users;
    }
    public void setUsers(Set<User> users) {
    this.users = users;
    }

    
}
